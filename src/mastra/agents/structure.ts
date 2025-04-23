import { Agent } from '@mastra/core/agent'
import { gemini25flash as model } from './models'

// 調査結果を構造化データに変換するエージェント

export const structureAgent = new Agent({
  name: '構造化エージェント',
  model,
  instructions: `
与えられたメッセージを出力スキーマに従い構造化してください。
メッセージの末尾にJSON形式で表示されている可能性があります。
  `.trim(),
})
