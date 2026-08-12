// Mermicorn MCP Connector Registry
// Auto-registers all platform connectors into the MCPServer

export { supabaseQueryTool, supabaseInsertTool } from './supabase';
export { vercelListDeploymentsTool, vercelGetProjectTool } from './vercel';
export { hfTextGenerationTool, hfImageGenerationTool } from './huggingface';
export { linearListIssuesTool, linearCreateIssueTool } from './linear';
