// Prompts users paste into an AI to produce a tokenapp.usage.v1 JSON block.
// These are rendered into copy-to-clipboard buttons in the /usage page.
//
// Design: every prompt must tell the model to wrap output in
//   ```tokenapp-usage\n{ ... }\n```
// so a single regex on the browser side can extract it regardless of source.
//
// Two prompts: one smart prompt that auto-branches on whatever the target AI
// has access to (pasted data OR local log files), and one narrower prompt for
// estimating a single chat's tokens from inside that chat.

export interface PromptSpec {
  id: string;
  title: string;
  subtitle: string;
  where: string;           // short label describing where to paste the prompt
  body: string;            // raw prompt text
}

const SCHEMA_DESCRIPTION = `{
  "schema": "tokenapp.usage.v1",
  "source": "<openai-api | anthropic-api | openrouter | cursor | claude-code | codex-cli | aider | chatgpt-chat | manual | other>",
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
      "sessionId": "<optional 8-char id>",
      "taskContext": "<optional short label>"
    }
  ],
  "notes": "<one line describing which branch ran, any skipped files, ambiguity, or FX conversion>"
}`;

export const USAGE_PROMPTS: PromptSpec[] = [
  {
    id: 'universal',
    title: 'Get my usage',
    subtitle: 'One prompt — auto-detects whether you pasted data or have local log access.',
    where: 'Paste into any AI. If you have raw usage data (CSV, dashboard export), paste it ABOVE this prompt first. In Claude Code / Cursor / Codex CLI, no extra input needed — it will read your local logs.',
    body: `You are a data normalizer for token.app (TokenApp), an AI usage dashboard.

TASK
Produce a single tokenapp.usage.v1 JSON document of my AI spend and wrap it in a \`\`\`tokenapp-usage fenced block. Output only that block — no commentary, no preface, no trailing summary.

Pick the FIRST branch below that applies to your current environment and execute it.

BRANCH A — Raw usage data was pasted ABOVE this prompt
(CSV, billing dashboard screenshot-transcribed text, JSON from an API, etc.)
  → Normalize it into tokenapp.usage.v1 using the RULES below. Set "source" to the best-fit value (e.g. "openai-api", "anthropic-api", "openrouter", "manual").

BRANCH B — You have file-system access (you are a coding agent: Claude Code, Cursor agent, Codex CLI, Aider, etc.)
  Try these log sources in order and use the first that exists. You may use more than one if multiple apply — merge the events.
  1. Claude Code:  \`~/.claude/projects/**/*.jsonl\`
       • Keep lines where \`message.role == "assistant"\` AND \`message.usage\` exists.
       • ts = top-level \`timestamp\`. provider = \`"anthropic"\`. modelId = normalize(\`message.model\`) — skip the \`<synthetic>\` pseudo-model.
       • tokens from \`message.usage\`: \`input_tokens\`, \`output_tokens\`, \`cache_read_input_tokens\`, \`cache_creation_input_tokens\`.
       • source = \`"claude-code"\`.
  2. Cursor:       \`~/Library/Application Support/Cursor/User/globalStorage/**/*.json\` (macOS)
                   \`~/.config/Cursor/User/globalStorage/**/*.json\` (Linux)
       • source = \`"cursor"\`. Infer provider from model prefix.
  3. Codex CLI:    \`~/.codex/**/*.jsonl\`
       • source = \`"codex-cli"\`. provider = \`"openai"\` unless the log says otherwise.
  4. Aider:        \`.aider.chat.history.md\` in the cwd or any parent.
       • source = \`"aider"\`. Infer provider + model from the log's model markers.

BRANCH C — Neither A nor B applies
  → Output an empty events array with a helpful note:
\`\`\`tokenapp-usage
{ "schema": "tokenapp.usage.v1", "source": "other", "capturedAt": "<now>", "currency": "USD", "events": [],
  "notes": "No data pasted above and no local logs accessible. Paste a usage CSV/export above this prompt and re-run, or use the 'Estimate this chat' prompt from /usage." }
\`\`\`

SCHEMA (tokenapp.usage.v1)
${SCHEMA_DESCRIPTION}

RULES
1. Normalize modelId: lowercase, strip date suffixes ("claude-sonnet-4-6-20260301" → "claude-sonnet-4.6"; "gpt-4o-2024-08-06" → "gpt-4o"), prefer dot version ("claude-3.5-sonnet" not "claude-3-5-sonnet").
2. Aggregate events by (day, modelId) — one row per model per day. Omit sessionId and taskContext from the output unless the user explicitly asked for per-session breakdown. This keeps the paste small (tens of rows, not hundreds).
3. If the input has only spend and no tokens, set inputTokens/outputTokens to null but keep costUSD. If it has tokens and no cost, leave costUSD null — TokenApp will reprice from list price.
4. Convert non-USD amounts to USD using approximate FX for the event date; mention the FX in "notes".
5. Never include message content, tool inputs/outputs, file paths beyond the project folder name, API keys, emails, or any PII.
6. Never fabricate rows. If a field isn't in the input, omit it.

Now execute. Output only the fenced \`\`\`tokenapp-usage block.`,
  },

  {
    id: 'chat-estimate',
    title: 'Estimate this chat',
    subtitle: 'For subscription users — estimate the current conversation so you can extrapolate.',
    where: 'Paste into the chat you want to estimate (ChatGPT, Claude.ai, Gemini). Works best near the end of a long conversation.',
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
