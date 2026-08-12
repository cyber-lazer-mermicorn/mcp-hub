import { z } from 'zod';
import type { MCPTool } from '../mcp';

// Linear Connector Tools
// Requires: LINEAR_API_KEY in .env

const linearGQL = async (query: string, variables: Record<string, any> = {}) => {
  const token = process.env.LINEAR_API_KEY;
  if (!token) throw new Error('Missing LINEAR_API_KEY');
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${await res.text()}`);
  return res.json();
};

export const linearListIssuesTool: MCPTool = {
  name: 'linear_list_issues',
  description: 'List your assigned Linear issues',
  inputSchema: z.object({
    first: z.number().optional().default(20),
    states: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    issues: z.array(z.any()),
    count: z.number(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    try {
      const data = await linearGQL(`
        query($first: Int) {
          viewer {
            assignedIssues(first: $first) {
              nodes {
                id title state { name } priority url createdAt updatedAt
                team { name }
              }
            }
          }
        }
      `, { first: input.first });
      const issues = data?.data?.viewer?.assignedIssues?.nodes ?? [];
      return { issues, count: issues.length, error: null };
    } catch (e: any) {
      return { issues: [], count: 0, error: e.message };
    }
  },
};

export const linearCreateIssueTool: MCPTool = {
  name: 'linear_create_issue',
  description: 'Create a new issue in a Linear team',
  inputSchema: z.object({
    teamId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.number().min(0).max(4).optional().default(0),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    issueId: z.string().nullable(),
    url: z.string().nullable(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    try {
      const data = await linearGQL(`
        mutation($teamId: String!, $title: String!, $description: String, $priority: Int) {
          issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority }) {
            success
            issue { id url }
          }
        }
      `, input);
      const result = data?.data?.issueCreate;
      return {
        success: result?.success ?? false,
        issueId: result?.issue?.id ?? null,
        url: result?.issue?.url ?? null,
        error: null,
      };
    } catch (e: any) {
      return { success: false, issueId: null, url: null, error: e.message };
    }
  },
};
