import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

// 比較するため複数のLLMを用意する

export const gemini20flash = google('gemini-2.0-flash-001')
export const gemini25flash = google('gemini-2.5-flash-preview-04-17')
export const claude35haiku = anthropic('claude-3-5-haiku-latest')
export const gpt41mini = openai('gpt-4.1-mini')
export const gpt41nano = openai('gpt-4.1-nano')
