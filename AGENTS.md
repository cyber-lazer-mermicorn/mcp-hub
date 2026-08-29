# MCP Hub — Agent Doctrine

## What this repo is
Model Context Protocol (MCP) server hub: custom MCP servers, tool registrations, and client integrations for Cherry's AI constellation.
By Cherry Shanaley (Chan), AI Solutions Engineer.

## Tech stack
- **Protocol:** Model Context Protocol (MCP) SDK
- **Runtime:** Node.js + TypeScript strict
- **Transport:** stdio (local), SSE (remote)
- **Deployment:** Vercel (SSE servers)

## Coding rules
- Each MCP server is a standalone file in `servers/` implementing `McpServer`
- Tools declared with typed `z.object()` input schemas — never untyped
- Resources declared with explicit URI templates
- Prompts declared with typed arguments
- Server names follow `kebab-case` — matches the key in `mcp-config.json`
- All tool handlers return `{ content: [{ type: 'text', text: string }] }` — no raw objects

## Commands
```bash
npm install
npm run build
npm run server:github    # start GitHub MCP server
npm run server:supabase  # start Supabase MCP server
npm run test
```

## Do not
- Use untyped tool inputs
- Mix transport types in a single server file
- Hardcode API keys in server files
