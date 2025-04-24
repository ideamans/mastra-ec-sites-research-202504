import { z } from 'zod'
import { useSpreadSheetAsDocuments, useSpreadsheetWorksheetWithServiceAccountFile } from '../../lib/spreadsheet'

// 残タスクや調査結果を管理するためのドキュメントデータベース

// ドキュメントのデータ型
// 🛠️ 改造ポイント
// 記録したい内容に応じてフィールドを変更する
export const dataSchema = z.object({
  // スプレッドシートのフィールド名(1行目)と揃えるためプロパティ名はあえて日本語にする
  名前: z.string(), // 必須
  通称: z.string(), // 必須
  ジャンル: z.string(),
  URL: z.string(), // 必須
  状態: z.enum(['調査中', '調査済み', '要注意', 'エラー', '']).optional(), // 必須
  公式通販サイトか否か: z.enum(['公式サイト', 'モール出店', 'その他']).optional(),
  ログインページのURL: z.string().optional(),
  カートページのURL: z.string().optional(),
  商品調査の状態: z.enum(['調査中', '調査済み', '要注意', 'エラー', '']).optional(),
  商品一覧のURL: z.string().optional(),
  商品一覧のHTMLタイトル: z.string().optional(),
  商品詳細のURL: z.string().optional(),
  商品詳細のHTMLタイトル: z.string().optional(),
  備考: z.string().optional(),
  エラー: z.string().optional(), // 必須
})

// ドキュメント操作モジュール
export const useItemsDocuments = async () => {
  const { sheet } = await useSpreadsheetWorksheetWithServiceAccountFile(
    process.env.GOOGLE_APPLICATION_CREDENTIALS!,
    process.env.GOOGLE_SPREADSHEET_ID!,
    process.env.GOOGLE_SHEET_NAME || 'Documents'
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
    backlog.documents = documents.filter(
      (doc) =>
        doc.data.状態 === '調査済み' && doc.data.公式通販サイトか否か === '公式サイト' && !doc.data.商品調査の状態
    )
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

  return { load: loadBacklog, get, update, hasBacklog, iterateBacklogKey }
}
