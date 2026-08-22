import { afterEach, describe, expect, it, vi } from 'vitest';
import { MCPServer } from '../lib/mcp';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MCPServer security boundaries', () => {
  it('fails closed when no MCP authorization token is configured', async () => {
    const server = new MCPServer();

    const response = await server.handle({
      tool: 'supabase_query',
      input: { table: 'approved_records' },
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('MCP_API_TOKEN must be configured');
  });

  it('rejects an incorrect MCP authorization token before invoking a tool', async () => {
    vi.stubEnv('MCP_API_TOKEN', 'expected-token');
    const server = new MCPServer();

    const response = await server.handle({
      tool: 'supabase_query',
      input: { table: 'approved_records' },
      authorization: 'wrong-token',
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('authorization token is invalid');
  });

  it('requires an explicit table allowlist and never accepts a service-role fallback', async () => {
    vi.stubEnv('MCP_API_TOKEN', 'expected-token');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_MCP_ALLOWED_TABLES', 'approved_records');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'must-not-be-used');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    const server = new MCPServer();

    const response = await server.handle({
      tool: 'supabase_query',
      input: { table: 'approved_records' },
      authorization: 'expected-token',
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('SUPABASE_ANON_KEY');
  });
});
