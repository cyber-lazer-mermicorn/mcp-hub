import { z } from 'zod';
import type { MCPTool } from '../mcp';

const MAX_QUERY_LIMIT = 100;
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const selectExpression = /^[A-Za-z0-9_.*,()\s]+$/;

function configuredTables(): Set<string> {
  const raw = process.env.SUPABASE_MCP_ALLOWED_TABLES ?? '';
  const tables = raw
    .split(',')
    .map((table) => table.trim())
    .filter((table) => identifier.test(table));
  return new Set(tables);
}

function requireApprovedTable(table: string): void {
  const tables = configuredTables();
  if (tables.size === 0) {
    throw new Error('SUPABASE_MCP_ALLOWED_TABLES must list one or more permitted tables');
  }
  if (!tables.has(table)) {
    throw new Error(`Table '${table}' is not approved for MCP access`);
  }
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}

function restUrl(baseUrl: string, table: string): URL {
  return new URL(`/rest/v1/${encodeURIComponent(table)}`, baseUrl);
}

const tableSchema = z.string().regex(identifier, 'table must be a simple identifier');
const columnSchema = z.string().regex(identifier, 'filter keys must be simple identifiers');

export const supabaseQueryTool: MCPTool = {
  name: 'supabase_query',
  description: 'Run a bounded SELECT query against an explicitly approved Supabase table.',
  inputSchema: z.object({
    table: tableSchema,
    select: z.string().regex(selectExpression, 'select contains unsupported characters').optional().default('*'),
    filter: z.record(columnSchema, z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    limit: z.number().int().positive().max(MAX_QUERY_LIMIT).optional().default(MAX_QUERY_LIMIT),
  }),
  outputSchema: z.object({
    rows: z.array(z.unknown()),
    count: z.number(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    requireApprovedTable(input.table);
    const { url, anonKey } = getSupabaseConfig();
    const endpoint = restUrl(url, input.table);
    endpoint.searchParams.set('select', input.select);
    endpoint.searchParams.set('limit', String(input.limit));

    for (const [column, value] of Object.entries(input.filter ?? {})) {
      endpoint.searchParams.set(column, `eq.${String(value)}`);
    }

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (!response.ok) return { rows: [], count: 0, error: await response.text() };
    const rows: unknown[] = await response.json();
    return { rows, count: rows.length, error: null };
  },
};

export const supabaseInsertTool: MCPTool = {
  name: 'supabase_insert',
  description: 'Insert a validated row into an explicitly approved Supabase table using RLS-scoped credentials.',
  inputSchema: z.object({
    table: tableSchema,
    data: z.record(z.string(), z.unknown()),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    inserted: z.unknown().nullable(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    requireApprovedTable(input.table);
    const { url, anonKey } = getSupabaseConfig();
    const response = await fetch(restUrl(url, input.table), {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(input.data),
    });
    if (!response.ok) return { success: false, inserted: null, error: await response.text() };
    const inserted: unknown[] = await response.json();
    return { success: true, inserted: inserted[0] ?? null, error: null };
  },
};
