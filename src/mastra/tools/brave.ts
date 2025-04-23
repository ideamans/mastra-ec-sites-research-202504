import { MCPConfiguration, MCPConfigurationOptions } from '@mastra/mcp'

const configuration: MCPConfigurationOptions = {
  id: 'web-mcp',
  servers: {
    'brave-search': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
      },
    },
  },
}

export const braveSearchMcp = new MCPConfiguration(configuration)
