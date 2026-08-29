# Architecture

## Overview
MCP Hub provides a collection of Model Context Protocol servers for Cherry's AI constellation, enabling Copilot and other AI clients to access Mermicorn tools.

## Server registry

| Server | File | Transport | Purpose |
|---|---|---|---|
| github | `servers/github.ts` | stdio | GitHub repo and issue operations |
| supabase | `servers/supabase.ts` | stdio | DB queries and auth |
| commerce | `servers/commerce.ts` | SSE | Product and listing operations |
| travel | `servers/travel.ts` | SSE | Deal research and comparison |

## Key patterns

### Tool declaration
All tools use `z.object()` typed schemas. Input validation is free — Zod throws before the handler runs.

### Resource URIs
Resources follow `mermicorn://{server}/{resource-type}/{id}` URI template pattern.

### Config
`mcp-config.json` at repo root maps server names to their startup commands for client registration.
