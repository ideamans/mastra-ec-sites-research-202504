import { dataSchema } from '../mastra/tools/documents'

// ヘッダの一覧をタブ区切りで表示

const headers = Object.entries(dataSchema.shape)
  .map(([key]) => key.toString())
  .join('\t')

console.log(headers)
