import { MCPConfiguration, MCPConfigurationOptions } from '@mastra/mcp'
import PsList from 'ps-list'
import Fkill from 'fkill'
import { Logger } from '@mastra/core'

// ブラウザ操作・Web検索のためのMCPサーバー

const configuration: MCPConfigurationOptions = {
  id: 'web-mcp',
  servers: {
    playwright: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
    },
  },
}
const expectedServers = Object.keys(configuration.servers).length

export const playwrightMcp = new MCPConfiguration(configuration)

export async function restart(logger?: Logger) {
  async function psMcps() {
    const ps = await PsList()
    const mcps = ps.filter(
      (p) => p.cmd?.includes('mcp-server-playwright') || p.cmd?.includes('mcp-server-brave-search')
    )
    return mcps
  }

  {
    logger?.info('🛑 MCPサーバーを一度終了します')
    const mcps = await psMcps()
    for (const mcp of mcps) {
      await Fkill(mcp.pid)
    }
  }

  do {
    const mcps = await psMcps()
    if (mcps.length < 1) break
    logger?.warn('⚠️ MCPサーバーの終了を待機します')
    await new Promise((ok) => setTimeout(ok, 1000))
  } while (true)

  logger?.info('▶️ MCPサーバーを起動します')
  const tools = await playwrightMcp.getTools()

  do {
    const mcps = await psMcps()
    if (mcps.length >= expectedServers) break
    logger?.warn('⚠️ MCPサーバーの開始を待機します')
    await new Promise((ok) => setTimeout(ok, 1000))
  } while (true)
}
