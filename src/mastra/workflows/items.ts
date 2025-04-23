import { Workflow, Step } from '@mastra/core/workflows'
import { z } from 'zod'
import { Lock } from 'async-await-mutex-lock'

import { restart } from '../tools/playwright'
import { useItemsDocuments } from '../tools/items-documents'

// AIエージェントとGoogleスプレッドシートによるバッチ処理の実装

// Googleスプレッドシートによるドキュメント機能を利用する
const documents = await useItemsDocuments()

// 残タスクの読み込みステップ
export const loadBacklogStep = new Step({
  id: 'load-backlog',
  description: '残タスクのドキュメントを読み込む',
  execute: async ({ context, mastra }) => {
    const { length, errors } = await documents.load()
    for (const error of errors) {
      mastra?.getLogger()?.error(`(Load Backlog Step): 💣 ドキュメント読み込みエラー: ${error}`)
    }
    mastra?.getLogger()?.info(`(Load Backlog Step): 🗒️ 調査対象: ${length}件`)
  },
})

// MCPサーバの再起動制御
// Playwrightが時々応答不能になるので定期的に再起動する
const restartMcpsEach = 5
let mcpsLife = restartMcpsEach

// ロック
// 原因は不明だが、プレイグラウンドURLからワークフローを起動すると
// ワークフローが重複して立ち上がることがある
const iterationLock = new Lock()

// 残タスクを繰り返し取り出し、AIエージェントによる商品の調査を行うステップ
export const iterationStep = new Step({
  id: 'iteration',
  description: '残タスクの取り出しとAIエージェントによる調査を繰り返し行う',
  execute: async ({ mastra }) => {
    await iterationLock.acquire()
    try {
      // 以下の処理を行う
      // 1. 残タスクの取り出しと確認・ロック
      // 2. 調査エージェントによる調査とコメント作成
      // 3. 調査コメントを構造化してGoogleスプレッドシートを更新

      // 必要なエージェントを取得する
      const itemsAgent = mastra?.getAgent('itemsAgent')
      if (!itemsAgent) throw new Error('Agent not found')
      const structureAgent = mastra?.getAgent('structureAgent')
      if (!structureAgent) throw new Error('Agent not found')

      // タスクの繰り返し

      if (mcpsLife-- <= 0) {
        // MCPサーバの再起動
        await restart(mastra?.getLogger())
        mcpsLife = restartMcpsEach
      }

      const rowKey = documents.iterateBacklogKey()
      if (!rowKey) {
        mastra?.getLogger()?.warn('(Iteration Step): ⚠️ 調査対象がありません')
        return
      }

      // 並列処理では調査の重複がありえるので最新の情報を確認する
      const doc = await documents.get(rowKey)
      if (!doc || !!doc.data.商品調査の状態) {
        mastra
          ?.getLogger()
          ?.info(`(Iteration Step): ⏭️ #${rowKey} は他のプロセスによる調査が行われているためスキップします`)
        return
      }

      mastra?.getLogger()?.info(`(Iteration Step): ▶️ 調査開始: #${rowKey} ${JSON.stringify(doc.data)}`)

      // 簡易的なロックの目的で状態: 調査中にする
      await documents.update(rowKey, { 商品調査の状態: '調査中', エラー: '' })

      try {
        // LLMからのテキストストリーム管理
        const all: string[] = []

        // バッファリングと適度な出力
        let buffer: string[] = []
        const flushEach = 80

        function flushStreamBuffer(force: boolean) {
          // 改行を含む場合はすぐに出力
          const maybeLines = buffer.join('')
          if (maybeLines.includes('\n')) {
            const lines = maybeLines.split('\n')

            // 最後の行だけは保留する
            const last = lines.pop()
            buffer = [last || '']

            for (const line of lines) {
              mastra?.getLogger()?.info(`(Iteration #${rowKey}): ${line}`)
            }
          }

          // ある程度の長さに達したら出力
          const maybeLong = buffer.join('')
          if (force || maybeLong.length >= flushEach) {
            mastra?.getLogger()?.info(`(Iteration #${rowKey}): ${buffer.join('')}`)
            buffer = []
          }
        }

        // 調査エージェントをテキストストリームで実行
        // 🛠️ 改造ポイント
        // 調査エージェントのプロンプトに応じて
        const prompt = JSON.stringify({ 名前: doc.data.名前, URL: doc.data.URL })
        const stream = await itemsAgent.stream(prompt)

        // テキストチャンクをバッファリング
        for await (const chunk of stream.textStream) {
          all.push(chunk)
          buffer.push(chunk)
          flushStreamBuffer(false)
        }

        // 残りのメッセージを出力
        if (buffer.length > 0) {
          flushStreamBuffer(true)
        }

        // 調査コメント
        const comment = all.join('')

        // 調査コメントから更新用のデータを生成する
        // 🛠️ 改造ポイント
        // src/mastra/tools/documents.tsのdataSchemaの変更に合わせて
        // outputのスキーマを変更する
        const updateSchema = z.object({
          商品一覧のURL: z.string().min(1).startsWith('https://').describe('商品一覧ページのURL'),
          商品一覧のHTMLタイトル: z.string().min(1).describe('商品一覧ページのHTMLタイトル'),
          商品詳細のURL: z.string().min(1).startsWith('https://').describe('商品詳細ページのURL'),
          商品詳細のHTMLタイトル: z.string().min(1).describe('商品詳細ページのHTMLタイトル'),
        })
        const updateData = await structureAgent.generate(
          `
    以下の調査コメントを構造化してください。
    アクセスランキングの有無=有りの場合はアクセスランキングの名称も出力してください。
    ---
    ${comment}
        `,
          {
            output: updateSchema,
          }
        )

        // 調査が完了したら調査済みにする
        mastra
          ?.getLogger()
          ?.info(`(Iteration Step): ☑️ #${rowKey} 調査が完了しました: ${JSON.stringify(updateData.object)}`)

        // 調査結果を確認
        const validation = updateSchema.safeParse(updateData.object)
        if (validation.success) {
          await documents.update(rowKey, { ...updateData.object, 商品調査の状態: '調査済み' })
        } else {
          await documents.update(rowKey, {
            ...updateData.object,
            商品調査の状態: '要注意',
            エラー: `${validation.error}`,
          })
        }
      } catch (error) {
        mastra?.getLogger()?.error(`(Iteration Step): 💣 #${rowKey} エラーが発生しました: ${error}`)
        // エラーも記録する
        await documents.update(rowKey, { 商品調査の状態: 'エラー', エラー: `${error}` })
      }
    } finally {
      await iterationLock.release()
    }
  },
})

// バッチ処理のワークフロー
export const itemsWorkflow = new Workflow({
  name: '商品調査のワークフロー',
})
  .step(loadBacklogStep) // 残タスクを読み込む
  .while(async () => documents.hasBacklog(), iterationStep) // 残タスクがある間、繰り返し調査を行う
  .commit()
