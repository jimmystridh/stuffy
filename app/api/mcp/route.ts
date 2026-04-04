import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { registerMcpTools } from '@/lib/mcp/tools'
import { verifyMcpBearerToken } from '@/lib/mcp/auth'

const mcpHandler = createMcpHandler(
  async (server) => {
    registerMcpTools(server)
  },
  {
    serverInfo: {
      name: 'stuffy-mcp',
      version: '0.1.0',
    },
  },
  {
    maxDuration: 60,
    verboseLogs: false,
    basePath: '/api',
    disableSse: true,
    sessionIdGenerator: undefined,
  }
)

const handler = withMcpAuth(mcpHandler, verifyMcpBearerToken, {
  required: true,
  resourceMetadataPath: '/api/mcp/oauth/protected-resource',
  resourceUrl: process.env.MCP_RESOURCE_URL,
})

export { handler as GET, handler as POST, handler as DELETE }
