import { z } from 'zod';
import type { MCPTool } from '../mcp';

// Supabase Connector Tools
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY in .env

export const supabaseQueryTool: MCPTool = {
  name: 'supabase_query',
  description: 'Run a SELECT query against a Supabase table',
  inputSchema: z.object({
    table: z.string(),
    select: z.string().optional().default('*'),
    filter: z.record(z.any()).optional(),
    limit: z.number().optional().default(100),
  }),
  outputSchema: z.object({
    rows: z.array(z.any()),
    count: z.number(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

    let endpoint = `${url}/rest/v1/${input.table}?select=${input.select}&limit=${input.limit}`;
    if (input.filter) {
      for (const [k, v] of Object.entries(input.filter)) {
        endpoint += `&${k}=eq.${v}`;
      }
    }

    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return { rows: [], count: 0, error: await res.text() };
    const rows = await res.json();
    return { rows, count: rows.length, error: null };
  },
};

export const supabaseInsertTool: MCPTool = {
  name: 'supabase_insert',
  description: 'Insert a row into a Supabase table',
  inputSchema: z.object({
    table: z.string(),
    data: z.record(z.any()),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    inserted: z.any().nullable(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

    const res = await fetch(`${url}/rest/v1/${input.table}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(input.data),
    });
    if (!res.ok) return { success: false, inserted: null, error: await res.text() };
    const inserted = await res.json();
    return { success: true, inserted: inserted[0] ?? null, error: null };
  },
};
