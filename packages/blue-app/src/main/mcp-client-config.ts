import type { McpClientConfigTarget } from '../shared/mcp-server';

/**
 * Builds local MCP client configuration snippets for supported editors/CLIs.
 * Runs in Electron main; only Cursor embeds the bearer token directly, while
 * VS Code prompts for a secret input and Codex references `BLUE_MCP_TOKEN`.
 */
export function buildMcpClientConfig(
  target: McpClientConfigTarget,
  endpointUrl: string,
  token: string,
): string {
  switch (target) {
    case 'cursor':
      return JSON.stringify(
        {
          mcpServers: {
            blue: {
              url: endpointUrl,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          },
        },
        null,
        2,
      );
    case 'vscode':
      return JSON.stringify(
        {
          inputs: [
            {
              type: 'promptString',
              id: 'blue-mcp-token',
              description: 'Blue local MCP bearer token',
              password: true,
            },
          ],
          servers: {
            blue: {
              type: 'http',
              url: endpointUrl,
              headers: {
                Authorization: 'Bearer ${input:blue-mcp-token}',
              },
            },
          },
        },
        null,
        2,
      );
    case 'codex':
      return `[mcp_servers.blue]\nurl = ${JSON.stringify(endpointUrl)}\nbearer_token_env_var = "BLUE_MCP_TOKEN"\n`;
  }
}
