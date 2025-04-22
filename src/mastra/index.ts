import { Mastra } from '@mastra/core'
import { createLogger } from '@mastra/core/logger'
import { surveyAgent } from './agents/survey'
import { batchWorkflow } from './workflows/batch'
import { structureAgent } from './agents/structure'
import { LangfuseExporter } from 'langfuse-vercel'

// Mastraフレームワーク

export const mastra = new Mastra({
  agents: { surveyAgent, structureAgent },
  workflows: { batchWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    serviceName: 'ai',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL,
      }),
    },
  },
})
