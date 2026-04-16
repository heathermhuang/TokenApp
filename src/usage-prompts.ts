// Prompts users paste into an AI to produce a tokenapp.usage.v1 JSON block.
// These are rendered into copy-to-clipboard buttons in the /usage page.
//
// Design: every prompt must tell the model to wrap output in
//   ```tokenapp-usage\n{ ... }\n```
// so a single regex on the browser side can extract it regardless of source.

export interface PromptSpec {
  id: string;
  title: string;
  subtitle: string;
  where: string;           // short label describing where to paste the prompt
  body: string;            // raw prompt text
}

const SCHEMA_DESCRIPTION = `{
  "schema": "tokenapp.usage.v1",
  "source": "<openai-api | anthropic-api | openrouter | cursor | claude-code | codex-cli | gemini-api | vertex | chatgpt-chat | manual | other>",
  "capturedAt": "<ISO8601 UTC timestamp>",
  "currency": "USD",
  "events": [
    {
      "ts": "<ISO8601 UTC, day precision OK>",
      "provider": "<openai | anthropic | google | meta | mistral | deepseek | xai | qwen | cohere | other>",
      "modelId": "<canonical model id, lowercase, e.g. 'gpt-4o', 'claude-sonnet-4.6', 'gemini-2.5-pro'>",
      "inputTokens": <integer or null>,
      "outputTokens": <integer or null>,
      "cachedInputTokens": <integer, 0 if unknown>,
      "cacheCreationTokens": <integer, 0 if unknown>,
      "requests": <integer or null>,
      "costUSD": <number or null>,
      "taskContext": "<optional short label>"
    }
  ],
  "notes": "<one line describing ambiguity, missing fields, or currency conversion>"
}`;

const UNIVERSAL_RULES = `RULES
1. If input has only spend, no tokens: set inputTokens/outputTokens to null but keep costUSD.
2. If input has only tokens, no cost: leave costUSD null — TokenApp reprices from list price.
3. Roll rows up to ONE event per (day, model) unless the source is per-request and fewer than 500 rows total.
4. Normalize model names: strip date suffixes that don't affect price. "gpt-4o-2024-08-06" → "gpt-4o". "claude-3-5-sonnet-20241022" → "claude-3.5-sonnet". Prefer dot version notation (e.g. "claude-sonnet-4.5", "claude-3.5-sonnet") — this matches the canonical price table.
5. Convert non-USD amounts to USD using approximate FX for the event date and record it in "notes".
6. If the provider is ambiguous, pick the most likely and note it.
7. Never fabricate rows. If a field isn't in the input, omit it.
8. Never include PII (email, account ID, API key) or message content.`;

export const USAGE_PROMPTS: PromptSpec[] = [
  {
    id: 'universal',
    title: 'Reformat a CSV or dashboard paste',
    subtitle: 'Works with ChatGPT, Claude, Gemini, Grok, DeepSeek — any chat.',
    where: 'Paste your raw usage data FIRST, then paste this prompt BELOW it in the chat.',
    body: `You are a data normalizer for token.app (TokenApp), an AI usage dashboard.

TASK
Convert the usage data I pasted above into a single JSON document matching the tokenapp.usage.v1 schema. Output the JSON inside a \`\`\`tokenapp-usage fenced block and nothing else — no commentary, no preface, no trailing summary.

SCHEMA (tokenapp.usage.v1)
${SCHEMA_DESCRIPTION}

${UNIVERSAL_RULES}

Now convert the data I pasted above. Output only the fenced \`\`\`tokenapp-usage block.`,
  },

  {
    id: 'claude-code',
    title: 'Read Claude Code history',
    subtitle: 'Autonomous — reads ~/.claude/projects/ JSONL logs.',
    where: 'Paste into a Claude Code session. Claude Code has the file access it needs.',
    body: `You have file access. Produce a tokenapp.usage.v1 export of my Claude Code history.

STEPS
1. Glob ~/.claude/projects/**/*.jsonl
2. For each file, read line-by-line. Each line is a JSON object. Keep only lines where message.role == "assistant" AND message.usage exists.
3. For each kept line, emit one event:
   - ts: top-level "timestamp" (ISO8601)
   - provider: "anthropic"
   - modelId: normalize message.model — strip date suffix AND convert dash-version to dot-version (e.g. "claude-sonnet-4-6-20260301" → "claude-sonnet-4.6", "claude-3-5-sonnet-20241022" → "claude-3.5-sonnet")
   - inputTokens: message.usage.input_tokens
   - outputTokens: message.usage.output_tokens
   - cachedInputTokens: message.usage.cache_read_input_tokens || 0
   - cacheCreationTokens: message.usage.cache_creation_input_tokens || 0
   - requests: 1
   - costUSD: null
   - sessionId: first 8 hex chars of sha1(filename)
   - taskContext: the project-slug directory name (the folder under projects/)
4. Aggregate by (day, modelId, sessionId). Sum tokens and requests. If total rows would exceed 2000, drop sessionId and aggregate by (day, modelId) only.
5. Never include message.content, tool inputs/outputs, file paths beyond the project-slug, or any user text.

OUTPUT
A single fenced block, no commentary before or after:

\`\`\`tokenapp-usage
{
  "schema": "tokenapp.usage.v1",
  "source": "claude-code",
  "capturedAt": "<ISO8601 now UTC>",
  "currency": "USD",
  "events": [ ... ],
  "notes": "Parsed from ~/.claude/projects JSONL logs. costUSD intentionally null — TokenApp reprices."
}
\`\`\`

If a file is unparseable, skip it and note the skipped count in "notes".`,
  },

  {
    id: 'coding-agent',
    title: 'Read Cursor / Codex CLI / Aider logs',
    subtitle: 'Autonomous — detects which tool is installed and reads its logs.',
    where: 'Paste into an agent with file access (Cursor Agent mode, a Codex CLI session, etc).',
    body: `You have file access. Produce a tokenapp.usage.v1 export of my coding-agent history.

LOCATIONS (try in order, use the first that exists)
- Cursor (macOS):  ~/Library/Application Support/Cursor/User/globalStorage/**/*.json
- Cursor (Linux):  ~/.config/Cursor/User/globalStorage/**/*.json
- Codex CLI:       ~/.codex/**/*.jsonl
- Aider:           find . -name ".aider.chat.history.md" (current directory and upwards)

STEPS
1. Detect which tool is present. Set "source" accordingly: "cursor" | "codex-cli" | "aider".
2. Parse the logs. For each assistant turn that has a usage or tokens record, emit one event following tokenapp.usage.v1.
3. Normalize modelId to lowercase canonical form; strip date suffixes. Infer provider from model prefix when present, otherwise from tool defaults (Cursor → likely "openai" or "anthropic"; Codex CLI → "openai"; Aider → whatever is configured in the log).
4. Aggregate by (day, modelId). Drop per-request granularity if over 2000 rows.
5. Never include message content, file contents, or paths beyond the project folder name.

OUTPUT
Single fenced \`\`\`tokenapp-usage block, JSON only, no commentary. Schema:

${SCHEMA_DESCRIPTION}

If relevant logs don't exist, output:
\`\`\`tokenapp-usage
{ "schema": "tokenapp.usage.v1", "source": "other", "capturedAt": "<now>", "events": [], "notes": "No logs found at expected paths." }
\`\`\``,
  },

  {
    id: 'chat-estimate',
    title: 'Estimate a ChatGPT / Claude.ai / Gemini conversation',
    subtitle: 'For subscription users — estimates one conversation so you can extrapolate.',
    where: 'Paste into the chat where you want to estimate. Works best near the end of a long conversation.',
    body: `You cannot see my billing or account usage. Don't pretend. Instead: estimate THIS conversation's token usage so I can extrapolate across my subscription.

STEPS
1. Count words in the full transcript so far (mine + yours). Convert to tokens: roughly words × 1.33 for English, × 2 for CJK.
2. Split between inputTokens (my turns) and outputTokens (your turns).
3. Assume the model is the one currently selected in the UI. If unsure, ask me to confirm before outputting.

OUTPUT
A single fenced \`\`\`tokenapp-usage block, no commentary outside:

\`\`\`tokenapp-usage
{
  "schema": "tokenapp.usage.v1",
  "source": "chatgpt-chat",
  "capturedAt": "<ISO8601 now UTC>",
  "currency": "USD",
  "events": [
    {
      "ts": "<today>",
      "provider": "<openai | anthropic | google>",
      "modelId": "<confirmed or best guess>",
      "inputTokens": <estimate>,
      "outputTokens": <estimate>,
      "requests": <turn count>,
      "costUSD": null,
      "taskContext": "chat estimate"
    }
  ],
  "notes": "ESTIMATE for a single conversation. Extrapolate as: daily_chats × this_conversation_cost."
}
\`\`\``,
  },
];
