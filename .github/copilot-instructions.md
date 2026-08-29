# GitHub Copilot Instructions — MCP Hub

## Always
- Declare tool inputs as `z.object()` Zod schemas
- Return `{ content: [{ type: 'text', text: string }] }` from tool handlers
- Keep each server in its own file under `servers/`
- Use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`

## Never
- Use untyped `any` for tool parameters
- Mix stdio and SSE transport in one server
- Hardcode credentials

## Pattern: MCP tool
```typescript
server.tool('get-user', { userId: z.string() }, async ({ userId }) => {
  const user = await fetchUser(userId);
  return { content: [{ type: 'text', text: JSON.stringify(user) }] };
});
```
