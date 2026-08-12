import { z } from 'zod';
import type { MCPTool } from '../mcp';

// Vercel Connector Tools
// Requires: VERCEL_API_TOKEN in .env

export const vercelListDeploymentsTool: MCPTool = {
  name: 'vercel_list_deployments',
  description: 'List recent Vercel deployments for your account',
  inputSchema: z.object({
    projectId: z.string().optional(),
    limit: z.number().optional().default(10),
    state: z.enum(['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED']).optional(),
  }),
  outputSchema: z.object({
    deployments: z.array(z.any()),
    count: z.number(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) throw new Error('Missing VERCEL_API_TOKEN');

    let endpoint = `https://api.vercel.com/v6/deployments?limit=${input.limit}`;
    if (input.projectId) endpoint += `&projectId=${input.projectId}`;
    if (input.state) endpoint += `&state=${input.state}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { deployments: [], count: 0, error: await res.text() };
    const data = await res.json();
    return { deployments: data.deployments ?? [], count: data.deployments?.length ?? 0, error: null };
  },
};

export const vercelGetProjectTool: MCPTool = {
  name: 'vercel_get_project',
  description: 'Get details for a specific Vercel project by name or ID',
  inputSchema: z.object({
    idOrName: z.string(),
  }),
  outputSchema: z.object({
    project: z.any().nullable(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) throw new Error('Missing VERCEL_API_TOKEN');

    const res = await fetch(`https://api.vercel.com/v9/projects/${input.idOrName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { project: null, error: await res.text() };
    return { project: await res.json(), error: null };
  },
};
