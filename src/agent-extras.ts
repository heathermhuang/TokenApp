// Agent-readiness extras: WebMCP client-side tool registration and the
// Agent Skills index (agentskills.io).

// WebMCP (webmcp.org) — inline module script that registers tools via
// navigator.modelContext.registerTool on page load. Agents running inside a
// browser (e.g. Chrome with the Agent SDK) pick these up automatically.
export const WEB_MCP_SCRIPT = `<script type="module">
(function () {
  if (!('modelContext' in navigator) || !navigator.modelContext) return;
  const mc = navigator.modelContext;

  async function fetchModels() {
    const r = await fetch('/api/models').then(r => r.json());
    return r.models || [];
  }

  mc.registerTool({
    name: 'lookup_model_price',
    description: 'Look up current token pricing for a specific AI model by id or slug (e.g. "openai/gpt-4o" or "gpt-4o").',
    inputSchema: {
      type: 'object',
      properties: { model_id: { type: 'string', description: 'Model id or slug' } },
      required: ['model_id']
    },
    annotations: { readOnlyHint: true },
    execute: async ({ model_id }) => {
      const models = await fetchModels();
      const n = String(model_id || '').toLowerCase();
      const m = models.find(x => x.id.toLowerCase() === n)
            || models.find(x => x.slug && x.slug.toLowerCase() === n)
            || models.find(x => x.id.toLowerCase().endsWith('/' + n));
      if (!m) return { error: 'Model not found', query: model_id };
      return {
        id: m.id,
        name: m.name,
        provider: m.providerId,
        inputPerMillion: m.inputPer1M,
        outputPerMillion: m.outputPer1M,
        contextWindow: m.contextWindow,
        vision: m.isVision,
        reasoning: m.isReasoning
      };
    }
  });

  mc.registerTool({
    name: 'search_models',
    description: 'Search tracked AI models. Combine filters with AND. Returns up to 25 results sorted by input price.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        free_only: { type: 'boolean' },
        vision_only: { type: 'boolean' },
        reasoning_only: { type: 'boolean' },
        max_input_price_per_1m: { type: 'number' }
      }
    },
    annotations: { readOnlyHint: true },
    execute: async (args = {}) => {
      let models = await fetchModels();
      if (args.provider) models = models.filter(m => m.providerId === args.provider);
      if (args.free_only) models = models.filter(m => m.isFree);
      if (args.vision_only) models = models.filter(m => m.isVision);
      if (args.reasoning_only) models = models.filter(m => m.isReasoning);
      if (typeof args.max_input_price_per_1m === 'number') {
        models = models.filter(m => m.inputPer1M != null && m.inputPer1M <= args.max_input_price_per_1m);
      }
      models.sort((a, b) => (a.inputPer1M ?? Infinity) - (b.inputPer1M ?? Infinity));
      return models.slice(0, 25).map(m => ({
        id: m.id, name: m.name, provider: m.providerId,
        inputPerMillion: m.inputPer1M, outputPerMillion: m.outputPer1M
      }));
    }
  });

  mc.registerTool({
    name: 'list_subscriptions',
    description: 'List all tracked AI subscription plans (ChatGPT Plus, Claude Pro, Gemini Advanced, etc.) with monthly prices.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await fetch('/api/subscriptions').then(r => r.json());
    }
  });
})();
</script>`;

// Inject the WebMCP script just before </body>. Safe no-op if the marker is
// absent (e.g. markdown response paths).
export function injectWebMcp(html: string): string {
  if (!html.includes('</body>')) return html;
  return html.replace('</body>', `${WEB_MCP_SCRIPT}\n</body>`);
}

// Agent Skills index (agentskills.io). Each skill describes a task an agent
// can perform against token.app's public surface.
export function buildAgentSkillsIndex(origin: string) {
  return {
    $schema: 'https://agentskills.io/schema/index.json',
    name: 'token.app',
    description:
      'Task-oriented skills for AI model pricing, comparison, and BYOK key management, powered by token.app live data.',
    homepage: origin,
    skills: [
      {
        id: 'lookup-model-price',
        name: 'Look up model price',
        description:
          'Given an AI model id or slug, return current input/output token prices and context window. Data refreshed hourly from OpenRouter and provider pricing pages.',
        inputs: ['model_id'],
        outputs: ['inputPer1M', 'outputPer1M', 'contextWindow'],
        endpoints: [
          { protocol: 'mcp', href: `${origin}/mcp`, tool: 'lookup_model_price' },
          { protocol: 'http', href: `${origin}/api/models`, method: 'GET' },
        ],
        examples: [
          'How much does GPT-4o cost per token?',
          'What is the current price of claude-sonnet-4-5?',
        ],
      },
      {
        id: 'find-cheapest-model',
        name: 'Find cheapest model for a capability',
        description:
          'Search models with filters like provider, free tier, vision support, reasoning, or max price. Useful for cost-conscious routing decisions.',
        inputs: ['provider?', 'free_only?', 'vision_only?', 'reasoning_only?', 'max_input_price_per_1m?'],
        outputs: ['models'],
        endpoints: [
          { protocol: 'mcp', href: `${origin}/mcp`, tool: 'search_models' },
          { protocol: 'http', href: `${origin}/api/models`, method: 'GET' },
        ],
        examples: [
          'Find the cheapest vision model under $1 per 1M tokens',
          'What free models does OpenRouter offer?',
        ],
      },
      {
        id: 'compare-subscriptions',
        name: 'Compare AI subscription plans',
        description:
          'List ChatGPT, Claude, Gemini, Perplexity, and other AI subscription plans with tier pricing.',
        inputs: [],
        outputs: ['subscriptions'],
        endpoints: [
          { protocol: 'mcp', href: `${origin}/mcp`, tool: 'list_subscriptions' },
          { protocol: 'http', href: `${origin}/api/subscriptions`, method: 'GET' },
        ],
        examples: [
          'What is the monthly price of Claude Pro vs ChatGPT Plus?',
          'Which AI subscription includes API credits?',
        ],
      },
      {
        id: 'byok-keyring',
        name: 'Resolve BYOK provider capabilities',
        description:
          "Query the keyring registry to discover which providers are supported for bring-your-own-key, what models each provider offers, and required OAuth/capability metadata.",
        inputs: [],
        outputs: ['providers', 'models', 'capabilities'],
        endpoints: [
          { protocol: 'mcp', href: `${origin}/mcp`, tool: 'get_registry' },
          { protocol: 'http', href: `${origin}/registry.json`, method: 'GET' },
        ],
        examples: [
          'Which providers support BYOK via token.app?',
          'What capabilities does the Groq keyring entry advertise?',
        ],
      },
    ],
  };
}
