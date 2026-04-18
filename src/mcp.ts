// Minimal MCP (Model Context Protocol) server for token.app.
// Exposes pricing + registry data as tools over JSON-RPC 2.0 on HTTP POST /mcp.
// Spec: https://modelcontextprotocol.io/
//
// Tools:
//   lookup_model_price    — exact pricing for a model id
//   search_models         — filter by provider / free / vision / reasoning
//   list_subscriptions    — all tracked subscription plans
//   get_registry          — BYOK keyring registry

import type { NormalizedModel, Subscription } from './types';

export const MCP_SERVER_INFO = {
  name: 'token-app',
  version: '1.0.0',
  description:
    'Live AI model pricing, subscription plans, and BYOK keyring registry from token.app.',
} as const;

const PROTOCOL_VERSION = '2025-03-26';

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'lookup_model_price',
    description:
      'Look up current input/output token prices for a specific model by id (e.g. "openai/gpt-4o" or "anthropic/claude-sonnet-4-5") or slug.',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'Model id or slug, e.g. "openai/gpt-4o" or "gpt-4o".',
        },
      },
      required: ['model_id'],
    },
  },
  {
    name: 'search_models',
    description:
      'Search tracked models. Filters are optional and combined with AND.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Provider id, e.g. "openai".' },
        free_only: { type: 'boolean' },
        vision_only: { type: 'boolean' },
        reasoning_only: { type: 'boolean' },
        max_input_price_per_1m: {
          type: 'number',
          description: 'Max USD per 1M input tokens.',
        },
        limit: { type: 'integer', default: 25 },
      },
    },
  },
  {
    name: 'list_subscriptions',
    description: 'List all tracked AI subscription plans with tier pricing.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_registry',
    description:
      'Return the BYOK keyring registry — providers, capabilities, and native model seeds.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

// ── Tool execution ────────────────────────────────────────────────────────────

type ToolContext = {
  models: NormalizedModel[];
  subscriptions: Subscription[];
  registry: unknown;
};

function findModel(models: NormalizedModel[], needle: string): NormalizedModel | null {
  const n = needle.toLowerCase().trim();
  return (
    models.find((m) => m.id.toLowerCase() === n) ??
    models.find((m) => m.slug.toLowerCase() === n) ??
    models.find((m) => m.id.toLowerCase().endsWith('/' + n)) ??
    null
  );
}

function toolResult(text: string, structured?: unknown) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  };
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'lookup_model_price': {
      const id = String(args.model_id ?? '');
      if (!id) return toolResult('Error: model_id is required');
      const m = findModel(ctx.models, id);
      if (!m) return toolResult(`No model found matching "${id}"`);
      const text =
        `${m.name || m.id} (${m.id})\n` +
        `Provider: ${m.provider}\n` +
        `Input: ${m.inputPer1M == null ? 'free' : '$' + m.inputPer1M.toFixed(2)} per 1M tokens\n` +
        `Output: ${m.outputPer1M == null ? 'free' : '$' + m.outputPer1M.toFixed(2)} per 1M tokens\n` +
        `Context: ${m.contextWindow ?? 'n/a'}\n` +
        `Vision: ${m.isVision} · Reasoning: ${m.isReasoning} · Tools: ${m.hasToolUse}`;
      return toolResult(text, m);
    }

    case 'search_models': {
      let results = ctx.models.slice();
      if (args.provider) {
        const p = String(args.provider).toLowerCase();
        results = results.filter((m) => m.providerId.toLowerCase() === p);
      }
      if (args.free_only) results = results.filter((m) => m.isFree);
      if (args.vision_only) results = results.filter((m) => m.isVision);
      if (args.reasoning_only) results = results.filter((m) => m.isReasoning);
      if (typeof args.max_input_price_per_1m === 'number') {
        const cap = args.max_input_price_per_1m;
        results = results.filter(
          (m) => m.inputPer1M != null && m.inputPer1M <= cap
        );
      }
      const limit = Math.max(1, Math.min(200, Number(args.limit ?? 25)));
      results.sort((a, b) => (a.inputPer1M ?? Infinity) - (b.inputPer1M ?? Infinity));
      const page = results.slice(0, limit);
      const lines = page.map(
        (m) =>
          `- ${m.name || m.id} (${m.id}) — in ${m.inputPer1M ?? 'free'}/1M, out ${m.outputPer1M ?? 'free'}/1M`
      );
      return toolResult(
        `Found ${results.length} models, returning ${page.length}:\n${lines.join('\n')}`,
        { total: results.length, models: page }
      );
    }

    case 'list_subscriptions': {
      const lines = ctx.subscriptions.map((s) => {
        const tiers = s.tiers
          .map((t) => `${t.name}: ${t.monthlyPrice != null ? '$' + t.monthlyPrice + '/mo' : 'contact sales'}`)
          .join(', ');
        return `- ${s.name} (${s.providerId}) — ${tiers}`;
      });
      return toolResult(
        `${ctx.subscriptions.length} subscription plans tracked:\n${lines.join('\n')}`,
        ctx.subscriptions
      );
    }

    case 'get_registry': {
      return toolResult(
        'BYOK keyring registry (see https://token.app/registry.json for full document).',
        ctx.registry
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC dispatch ─────────────────────────────────────────────────────────

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

export async function handleMcpRequest(
  body: unknown,
  ctx: ToolContext
): Promise<unknown> {
  if (!body || typeof body !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    };
  }
  const req = body as JsonRpcRequest;
  const id = req.id ?? null;

  try {
    switch (req.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: MCP_SERVER_INFO,
          },
        };

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

      case 'tools/call': {
        const params = req.params ?? {};
        const name = String(params.name ?? '');
        const args = (params.arguments as Record<string, unknown>) ?? {};
        const result = await callTool(name, args, ctx);
        return { jsonrpc: '2.0', id, result };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal error', data: String(err) },
    };
  }
}

// Public "server card" served at /.well-known/mcp — non-JSON-RPC discovery doc.
export function buildMcpServerCard(origin: string) {
  return {
    ...MCP_SERVER_INFO,
    protocolVersion: PROTOCOL_VERSION,
    endpoint: `${origin}/mcp`,
    transport: 'streamable-http',
    capabilities: { tools: { listChanged: false } },
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    documentation: `${origin}/about`,
  };
}
