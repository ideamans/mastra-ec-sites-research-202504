import { z } from 'zod'
import { useSpreadSheetAsDocuments, useSpreadsheetWorksheetWithServiceAccountFile } from '../../lib/spreadsheet'

// 残タスクや調査結果を管理するためのドキュメントデータベース

// ドキュメントのデータ型
// 🛠️ 改造ポイント
// 記録したい内容に応じてフィールドを変更する
export const dataSchema = z.object({
  // スプレッドシートのフィールド名(1行目)と揃えるためプロパティ名はあえて日本語にする
  名前: z.string(), // 必須
  URL: z.string(), // 必須
  状態: z.enum(['調査中', '調査済み', 'エラー']).optional(), // 必須
  アクセスランキングの有無: z.enum(['有り', '無し']).optional(),
  アクセスランキングの名称: z.string().optional(),
  備考: z.string().optional(),
  エラー: z.string().optional(), // 必須
})

// ドキュメント操作モジュール
export const useDocuments = async () => {
  const { sheet } = await useSpreadsheetWorksheetWithServiceAccountFile(
    process.env.GOOGLE_APPLICATION_CREDENTIALS!,
    process.env.GOOGLE_SPREADSHEET_ID!,
    process.env.GOOGLE_SHEET_NAME || 'Documents',
  )

  const { documentSchema, snapshot, get, update } = useSpreadSheetAsDocuments(sheet, dataSchema)

  // 残タスクのリストとイテレーションを可能にするindex
  const backlog: {
    documents: z.infer<typeof documentSchema>[]
    index: number
  } = {
    documents: [],
    index: 0,
  }

  // スプレッドシートから全ドキュメントを読み込み、作業が必要な残タスクをリスト化する
  async function loadBacklog() {
    const { documents, errors } = await snapshot()
    backlog.documents = documents.filter((doc) => !doc.data.状態)
    backlog.index = 0

    return {
      length: backlog.documents.length,
      errors,
    }
  }

  // 作業すべき残タスクがあるかの問い合わせ
  function hasBacklog() {
    return !!backlog.documents[backlog.index]
  }

  // 残タスクのイテレーション
  function iterateBacklogKey() {
    const doc = backlog.documents[backlog.index]
    if (!doc) return null
    backlog.index++

    return doc.rowKey
  }

  // 当初、エージェントにドキュメントの取得と更新を行わせる設計だったが、
  // ドキュメントの更新が期待通りに行われないことが多かった
  // 例えばGeminiはドキュメントの更新を行うが、フィールドが空になることが多く、
  // GPTはドキュメントの更新自体を飛ばしてしまうことあった
  // そのため、AIエージェントからのドキュメント操作は行わず、
  // ドキュメントの取得と更新はワークフローで明示的に行うことにする
  // 以下はAIエージェントのためにツール化する例
  // const agentTools = {
  //   getDocument: createTool({
  //     id: 'get-document',
  //     description: '行番号キーを指定してドキュメントを取得する',
  //     inputSchema: z.object({
  //       rowKey: z.number().describe('行番号キー'),
  //     }),
  //     outputSchema: documentSchema.or(z.null()),
  //     execute: async ({ context }) => {
  //       const document = await get(context.rowKey)
  //       return document
  //     },
  //   }),
  //   updateDocument: createTool({
  //     id: 'update-document',
  //     description: 'ドキュメントを部分更新する',
  //     inputSchema: partialDocumentSchema,
  //     outputSchema: z.string().or(z.null()),
  //     execute: async ({ context }) => {
  //       if (Object.keys(context.data).length === 0) {
  //         return 'dataが空です。更新するデータを含めてください。'
  //       }
  //       console.log({ updateDocument: context })
  //       await update(context.rowKey, context.data)
  //       return null
  //     },
  //   }),
  // }

  return { load: loadBacklog, get, update, hasBacklog, iterateBacklogKey }
}
