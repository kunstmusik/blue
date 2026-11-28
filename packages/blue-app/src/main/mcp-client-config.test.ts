import { describe, expect, it } from 'vite-plus/test';
import { buildMcpClientConfig } from './mcp-client-config';

const TEST_ENDPOINT = 'http://127.0.0.1:49210/mcp';
const TEST_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('buildMcpClientConfig (T038)', () => {
  it('builds Cursor JSON config using the actual endpoint and Bearer authorization header', () => {
    const raw = buildMcpClientConfig('cursor', TEST_ENDPOINT, TEST_TOKEN);
    const parsed = JSON.parse(raw) as {
      mcpServers: {
        blue: {
          url: string;
          headers: { Authorization: string };
        };
      };
    };

    expect(parsed).toEqual({
      mcpServers: {
        blue: {
          url: TEST_ENDPOINT,
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
          },
        },
      },
    });
  });

  it('builds VS Code JSON config with a secret prompt input and never embeds the raw token', () => {
    const raw = buildMcpClientConfig('vscode', TEST_ENDPOINT, TEST_TOKEN);
    expect(raw).not.toContain(TEST_TOKEN);

    const parsed = JSON.parse(raw) as {
      inputs: Array<{
        type: string;
        id: string;
        description: string;
        password: boolean;
      }>;
      servers: {
        blue: {
          type: string;
          url: string;
          headers: { Authorization: string };
        };
      };
    };

    expect(parsed).toEqual({
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
          url: TEST_ENDPOINT,
          headers: {
            Authorization: 'Bearer ${input:blue-mcp-token}',
          },
        },
      },
    });
  });

  it('builds Codex TOML config with bearer_token_env_var and never embeds the raw token', () => {
    const raw = buildMcpClientConfig('codex', TEST_ENDPOINT, TEST_TOKEN);

    expect(raw).not.toContain(TEST_TOKEN);
    expect(raw).toBe(
      `[mcp_servers.blue]\nurl = "${TEST_ENDPOINT}"\nbearer_token_env_var = "BLUE_MCP_TOKEN"\n`,
    );
  });

  it('builds OpenCode 2.x remote JSON with OAuth disabled and the current bearer header', () => {
    expect(JSON.parse(buildMcpClientConfig('opencode', TEST_ENDPOINT, TEST_TOKEN))).toEqual({
      mcp: {
        servers: {
          blue: {
            type: 'remote',
            url: TEST_ENDPOINT,
            oauth: false,
            headers: { Authorization: `Bearer ${TEST_TOKEN}` },
          },
        },
      },
    });
  });

  it('builds Antigravity JSON with the server URL and bearer header', () => {
    expect(JSON.parse(buildMcpClientConfig('antigravity', TEST_ENDPOINT, TEST_TOKEN))).toEqual({
      mcpServers: {
        blue: { serverUrl: TEST_ENDPOINT, headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
      },
    });
  });
});
