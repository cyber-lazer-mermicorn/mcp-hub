import { z } from 'zod';
import { readFileSync } from 'fs';
import {
  supabaseQueryTool,
  supabaseInsertTool,
  vercelListDeploymentsTool,
  vercelGetProjectTool,
  hfTextGenerationTool,
  hfImageGenerationTool,
  linearListIssuesTool,
  linearCreateIssueTool,
} from './connectors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  handler: (input: unknown) => Promise<unknown>;
}

export interface MCPRequest {
  tool: string;
  input: unknown;
  requestId?: string;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
  durationMs: number;
  tool: string;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 200;

// ─── Tool Registry ────────────────────────────────────────────────────────────

export class ToolRegistry {
  private readonly tools = new Map<string, MCPTool>();

  register(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered — use replace() to override.`);
    }
    this.tools.set(tool.name, tool);
  }

  replace(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): MCPTool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: '${name}'. Available: ${this.names().join(', ')}`);
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  search(query: string): MCPTool[] {
    const q = query.toLowerCase();
    return this.list().filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }

  size(): number {
    return this.tools.size;
  }
}

// ─── Read File Tool (real fs implementation) ─────────────────────────────────

const readFileTool: MCPTool = {
  name: 'read_file',
  description: 'Read the UTF-8 contents of a local file by absolute or relative path.',
  inputSchema: z.object({
    path: z.string().min(1),
    encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
  }),
  outputSchema: z.object({
    content: z.string(),
    sizeBytes: z.number(),
    encoding: z.string(),
  }),
  handler: async ({ path, encoding }) => {
    const raw = readFileSync(path as string);
    const content =
      encoding === 'base64' ? raw.toString('base64') : raw.toString('utf-8');
    return { content, sizeBytes: raw.byteLength, encoding: encoding as string };
  },
};

// ─── MCP Server ───────────────────────────────────────────────────────────────

export class MCPServer {
  private readonly registry: ToolRegistry;
  private readonly circuits = new Map<string, CircuitState>();
  private readonly telemetry: Array<{
    requestId: string;
    tool: string;
    success: boolean;
    durationMs: number;
    ts: number;
  }> = [];

  constructor() {
    this.registry = new ToolRegistry();
    this.bootstrap();
  }

  private bootstrap(): void {
    const tools: MCPTool[] = [
      readFileTool,
      supabaseQueryTool,
      supabaseInsertTool,
      vercelListDeploymentsTool,
      vercelGetProjectTool,
      hfTextGenerationTool,
      hfImageGenerationTool,
      linearListIssuesTool,
      linearCreateIssueTool,
    ];
    for (const tool of tools) this.registry.register(tool);
  }

  // ─── Circuit Breaker ──────────────────────────────────────────────────────

  private getCircuit(name: string): CircuitState {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, { failures: 0, lastFailure: 0, open: false });
    }
    return this.circuits.get(name)!;
  }

  private checkCircuit(name: string): void {
    const c = this.getCircuit(name);
    if (!c.open) return;
    const elapsed = Date.now() - c.lastFailure;
    if (elapsed >= CIRCUIT_RESET_MS) {
      c.open = false;
      c.failures = 0;
    } else {
      throw new Error(
        `Circuit open for '${name}' — cooling down (${Math.round((CIRCUIT_RESET_MS - elapsed) / 1000)}s remaining).`
      );
    }
  }

  private recordCircuit(name: string, failed: boolean): void {
    const c = this.getCircuit(name);
    if (failed) {
      c.failures += 1;
      c.lastFailure = Date.now();
      if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) c.open = true;
    } else {
      c.failures = 0;
      c.open = false;
    }
  }

  // ─── Retry with Exponential Backoff ──────────────────────────────────────

  private async withRetry<T>(
    fn: () => Promise<T>,
    toolName: string,
    attempt = 0
  ): Promise<T> {
    try {
      const result = await fn();
      this.recordCircuit(toolName, false);
      return result;
    } catch (err: unknown) {
      this.recordCircuit(toolName, true);
      if (attempt >= MAX_RETRIES - 1) throw err;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
      return this.withRetry(fn, toolName, attempt + 1);
    }
  }

  // ─── Request Handler ──────────────────────────────────────────────────────

  async handle<T = unknown>(request: MCPRequest): Promise<MCPResponse<T>> {
    const start = Date.now();
    const requestId = request.requestId ?? crypto.randomUUID();

    try {
      this.checkCircuit(request.tool);
      const tool = this.registry.get(request.tool);

      const parsed = tool.inputSchema.safeParse(request.input);
      if (!parsed.success) {
        throw new Error(`Input validation failed: ${parsed.error.message}`);
      }

      const raw = await this.withRetry(() => tool.handler(parsed.data), request.tool);

      const validated = tool.outputSchema.safeParse(raw);
      if (!validated.success) {
        throw new Error(`Output validation failed: ${validated.error.message}`);
      }

      const durationMs = Date.now() - start;
      this.record(requestId, request.tool, true, durationMs);
      return { success: true, data: validated.data as T, requestId, durationMs, tool: request.tool };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.record(requestId, request.tool, false, durationMs);
      return { success: false, error, requestId, durationMs, tool: request.tool };
    }
  }

  // ─── Telemetry ────────────────────────────────────────────────────────────

  private record(requestId: string, tool: string, success: boolean, durationMs: number): void {
    this.telemetry.push({ requestId, tool, success, durationMs, ts: Date.now() });
    if (this.telemetry.length > 1000) this.telemetry.splice(0, 100);
  }

  stats(): Record<string, { calls: number; errors: number; avgMs: number }> {
    const acc: Record<string, { calls: number; errors: number; totalMs: number }> = {};
    for (const entry of this.telemetry) {
      if (!acc[entry.tool]) acc[entry.tool] = { calls: 0, errors: 0, totalMs: 0 };
      acc[entry.tool].calls++;
      acc[entry.tool].totalMs += entry.durationMs;
      if (!entry.success) acc[entry.tool].errors++;
    }
    return Object.fromEntries(
      Object.entries(acc).map(([name, s]) => [
        name,
        { calls: s.calls, errors: s.errors, avgMs: Math.round(s.totalMs / s.calls) },
      ])
    );
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  tools(): Array<{ name: string; description: string; circuitOpen: boolean }> {
    return this.registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      circuitOpen: this.getCircuit(t.name).open,
    }));
  }

  health(): { status: 'healthy' | 'degraded'; tools: number; openCircuits: string[] } {
    const openCircuits = this.registry
      .names()
      .filter((n) => this.getCircuit(n).open);
    return {
      status: openCircuits.length === 0 ? 'healthy' : 'degraded',
      tools: this.registry.size(),
      openCircuits,
    };
  }
}

export const server = new MCPServer();
