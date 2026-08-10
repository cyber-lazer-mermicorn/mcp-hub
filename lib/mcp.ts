import { z } from 'zod';

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  handler: (input: any) => Promise<any>;
}

// Tool Registry
export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();

  register(tool: MCPTool) {
    try {
      this.tools.set(tool.name, tool);
      return { success: true };
    } catch (error: any) {
      throw new Error(`Register tool error: ${error?.message || 'Unknown error'}`);
    }
  }

  get(name: string): MCPTool | undefined {
    try {
      return this.tools.get(name);
    } catch (error: any) {
      throw new Error(`Get tool error: ${error?.message || 'Unknown error'}`);
    }
  }

  list(): MCPTool[] {
    try {
      return Array.from(this.tools.values());
    } catch (error: any) {
      throw new Error(`List tools error: ${error?.message || 'Unknown error'}`);
    }
  }

  search(query: string): MCPTool[] {
    try {
      const queryLower = query.toLowerCase();
      return this.list().filter(
        t => t.name.toLowerCase().includes(queryLower) || 
             t.description.toLowerCase().includes(queryLower)
      );
    } catch (error: any) {
      throw new Error(`Search tools error: ${error?.message || 'Unknown error'}`);
    }
  }
}

// Pre-built Tools
export const readFileTool: MCPTool = {
  name: 'read_file',
  description: 'Read contents of a file',
  inputSchema: z.object({ path: z.string() }),
  outputSchema: z.object({ content: z.string(), size: z.number() }),
  handler: async (input) => {
    try {
      // Implementation would read actual file
      return { content: `Contents of ${input.path}`, size: 1024 };
    } catch (error: any) {
      throw new Error(`Read file error: ${error?.message || 'Unknown error'}`);
    }
  },
};

export const queryDatabaseTool: MCPTool = {
  name: 'query_database',
  description: 'Execute a SQL query',
  inputSchema: z.object({ query: z.string(), params: z.array(z.any()).optional() }),
  outputSchema: z.object({ rows: z.array(z.any()), affectedRows: z.number() }),
  handler: async (input) => {
    try {
      // Implementation would execute actual query
      return { rows: [], affectedRows: 0 };
    } catch (error: any) {
      throw new Error(`Query database error: ${error?.message || 'Unknown error'}`);
    }
  },
};

export const generateTextTool: MCPTool = {
  name: 'generate_text',
  description: 'Generate text using AI',
  inputSchema: z.object({ prompt: z.string(), model: z.string().optional() }),
  outputSchema: z.object({ text: z.string(), tokens: z.number() }),
  handler: async (input) => {
    try {
      // Implementation would call AI API
      return { text: `Generated response for: ${input.prompt}`, tokens: 100 };
    } catch (error: any) {
      throw new Error(`Generate text error: ${error?.message || 'Unknown error'}`);
    }
  },
};

// MCP Server
export class MCPServer {
  private registry: ToolRegistry;

  constructor() {
    this.registry = new ToolRegistry();
    this.registerDefaults();
  }

  private registerDefaults() {
    this.registry.register(readFileTool);
    this.registry.register(queryDatabaseTool);
    this.registry.register(generateTextTool);
  }

  async handleRequest(request: {
    tool: string;
    input: any;
  }): Promise<any> {
    try {
      const tool = this.registry.get(request.tool);
      if (!tool) {
        throw new Error(`Tool not found: ${request.tool}`);
      }

      // Validate input
      const inputResult = tool.inputSchema.safeParse(request.input);
      if (!inputResult.success) {
        throw new Error(`Invalid input: ${inputResult.error.message}`);
      }

      // Execute tool
      const output = await tool.handler(inputResult.data);

      // Validate output
      const outputResult = tool.outputSchema.safeParse(output);
      if (!outputResult.success) {
        throw new Error(`Invalid output: ${outputResult.error.message}`);
      }

      return outputResult.data;
    } catch (error: any) {
      throw new Error(`Handle request error: ${error?.message || 'Unknown error'}`);
    }
  }

  getAvailableTools() {
    try {
      return this.registry.list().map(t => ({
        name: t.name,
        description: t.description,
      }));
    } catch (error: any) {
      throw new Error(`Get available tools error: ${error?.message || 'Unknown error'}`);
    }
  }
}
