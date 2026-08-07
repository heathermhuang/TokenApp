/**
 * Benchmark ingestion — Epoch AI "AI Benchmarking Hub".
 *
 * WHY EPOCH AND NOT THE OBVIOUS ALTERNATIVES (2026-08-05 sourcing review):
 *  • llm-stats.com — their live data is a COMMERCIAL product (Data API + MCP) and
 *    `/api/` is robots.txt-Disallow. Their open mirror IS CC BY 4.0, but it is
 *    dead: AchilleasDrakou/LLMStats last touched models/ on 2025-02-02 (newest
 *    OpenAI = o3), and the 359-star predecessor is explicitly DEPRECATED. Useful
 *    as a schema blueprint (this file's score shape is modelled on it), useless
 *    as a feed.
 *  • Vendor model cards — the primary source everyone aggregates, but vendors
 *    publish benchmarks as CHART IMAGES. Anthropic's Claude Opus 5 announcement
 *    states "more than doubles Opus 4.8" with no transcribable number, and the
 *    docs model table carries zero benchmark scores. Not machine-extractable.
 *  • Third-party SEO aggregators — contradict each other outright (same page set
 *    claimed both "96% SWE-bench" and "seven in ten" for one model). Unusable.
 *
 * Epoch RUNS its own evals rather than reprinting vendor claims, publishes a live
 * CSV, and licenses it CC BY. That is independently-run + machine-readable +
 * legally reusable, which none of the above manage together.
 *
 * Licence: CC BY. Attribution is REQUIRED and is rendered in the UI — see
 * ATTRIBUTION below. Do not remove it.
 * Note: some rows in Epoch's wider hub derive from Aider Polyglot / Terminal-Bench
 * (Apache-2.0). We surface only Epoch-run tasks (SURFACED below) to keep the
 * licence story single-sourced.
 */

import type { BenchmarkScore, BenchmarksPayload, Env, ModelBenchmarks } from './types';
import { KV_KEYS } from './types';

const EPOCH_CSV = 'https://epoch.ai/data/benchmarks.csv';

const ATTRIBUTION = {
  text: "Epoch AI, 'AI Benchmarking Hub'",
  url: 'https://epoch.ai/benchmarks',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

/**
 * The benchmarks we surface, in display order. Epoch publishes more, but these
 * are the ones with (a) meaningful coverage across the frontier and (b) a story
 * a pricing site can actually tell. `primary: true` marks the one used for the
 * headline quality column and the price/quality frontier — GPQA Diamond has the
 * broadest coverage in the feed by a wide margin (201 rows vs 33 for SWE-Bench).
 */
const SURFACED: { epochTask: string; id: string; label: string; blurb: string; primary?: boolean }[] = [
  { epochTask: 'GPQA diamond', id: 'gpqa_diamond', label: 'GPQA Diamond', blurb: 'Graduate-level science reasoning', primary: true },
  { epochTask: 'SWE-Bench verified', id: 'swe_bench_verified', label: 'SWE-bench Verified', blurb: 'Real GitHub issue resolution' },
  { epochTask: 'FrontierMath-Tiers-1-3-v2-Private', id: 'frontiermath_t13', label: 'FrontierMath T1–3', blurb: 'Research-level mathematics' },
  { epochTask: 'FrontierMath-Tier-4-v2-Private', id: 'frontiermath_t4', label: 'FrontierMath T4', blurb: 'Hardest research mathematics' },
  { epochTask: 'SimpleQA Verified', id: 'simpleqa_verified', label: 'SimpleQA Verified', blurb: 'Factual accuracy / hallucination' },
  { epochTask: 'OTIS Mock AIME 2024-2025', id: 'otis_mock_aime', label: 'OTIS Mock AIME', blurb: 'Competition mathematics' },
];

export const PRIMARY_BENCHMARK_ID = SURFACED.find((b) => b.primary)!.id;

/**
 * Epoch display name → OpenRouter model id.
 *
 * EXPLICIT ONLY, deliberately. Fuzzy name matching is what burned a whole phase
 * in the July drift pass, and the failure mode here is worse than a miss: Epoch
 * lists "Muse Spark" (2026-04-08) while our catalogue carries "muse-spark-1.1" —
 * a DIFFERENT model. A fuzzy matcher would happily staple one's benchmarks onto
 * the other. Anything not in this table lands in `unmapped` and shows up in the
 * API response so it can be added in a data-only PR.
 */
const MODEL_MAP: Record<string, string> = {
  // Anthropic
  'Claude Opus 5': 'anthropic/claude-opus-5',
  'Claude Sonnet 5': 'anthropic/claude-sonnet-5',
  'Claude Fable 5': 'anthropic/claude-fable-5',
  'Claude Opus 4.8': 'anthropic/claude-opus-4.8',
  'Claude Opus 4.7': 'anthropic/claude-opus-4.7',
  'Claude Opus 4.6': 'anthropic/claude-opus-4.6',
  'Claude Opus 4.5': 'anthropic/claude-opus-4.5',
  'Claude Opus 4.1': 'anthropic/claude-opus-4.1',
  'Claude Opus 4': 'anthropic/claude-opus-4',
  'Claude Sonnet 4.6': 'anthropic/claude-sonnet-4.6',
  'Claude Sonnet 4.5': 'anthropic/claude-sonnet-4.5',
  'Claude Sonnet 4': 'anthropic/claude-sonnet-4',
  'Claude Haiku 4.5': 'anthropic/claude-haiku-4.5',
  'Claude 3 Haiku': 'anthropic/claude-3-haiku',
  // OpenAI
  'GPT-5.6 Sol': 'openai/gpt-5.6-sol',
  'GPT-5.6 Terra': 'openai/gpt-5.6-terra',
  'GPT-5.6 Luna': 'openai/gpt-5.6-luna',
  'GPT-5.5': 'openai/gpt-5.5',
  'GPT-5.5 Pro': 'openai/gpt-5.5-pro',
  'GPT-5.4': 'openai/gpt-5.4',
  'GPT-5.4 Pro': 'openai/gpt-5.4-pro',
  'GPT-5.4 Mini': 'openai/gpt-5.4-mini',
  'GPT-5.4 Nano': 'openai/gpt-5.4-nano',
  'GPT-5.3 Codex': 'openai/gpt-5.3-codex',
  'GPT-5.2': 'openai/gpt-5.2',
  'GPT-5.2 Pro': 'openai/gpt-5.2-pro',
  'GPT-5.1': 'openai/gpt-5.1',
  'GPT-5': 'openai/gpt-5',
  'GPT-5 Pro': 'openai/gpt-5-pro',
  'GPT-5 mini': 'openai/gpt-5-mini',
  'GPT-5 nano': 'openai/gpt-5-nano',
  'GPT-4 Turbo (Apr 2024)': 'openai/gpt-4-turbo',   // = gpt-4-turbo-2024-04-09, the GA snapshot
  'GPT-4.1': 'openai/gpt-4.1',
  'GPT-4.1 mini': 'openai/gpt-4.1-mini',
  'GPT-4.1 nano': 'openai/gpt-4.1-nano',
  'GPT-4o': 'openai/gpt-4o',
  'GPT-4o mini': 'openai/gpt-4o-mini',
  'GPT-3.5 Turbo': 'openai/gpt-3.5-turbo',
  'gpt-oss-120b': 'openai/gpt-oss-120b',
  o1: 'openai/o1',
  o3: 'openai/o3',
  'o3-mini': 'openai/o3-mini',
  'o4-mini': 'openai/o4-mini',
  // Google
  'Gemini 3.6 Flash': 'google/gemini-3.6-flash',
  'Gemini 3.5 Flash': 'google/gemini-3.5-flash',
  // Our catalogue carries only the preview of these two exact versions — there is
  // no GA entry to confuse them with, so the mapping is unambiguous.
  'Gemini 3.1 Pro': 'google/gemini-3.1-pro-preview',   // see VERSION_PIN — Epoch's rows also cover -customtools
  'Gemini 3 Flash': 'google/gemini-3-flash-preview',
  'Gemini 2.5 Flash': 'google/gemini-2.5-flash',
  'Gemma 4 31B IT': 'google/gemma-4-31b-it',
  'Gemma 3 27B': 'google/gemma-3-27b-it',
  'Gemma 2 27B': 'google/gemma-2-27b-it',
  // Moonshot
  'Kimi K3': 'moonshotai/kimi-k3',
  'Kimi K2.7 Code': 'moonshotai/kimi-k2.7-code',
  'Kimi K2.6': 'moonshotai/kimi-k2.6',
  'Kimi K2.5': 'moonshotai/kimi-k2.5',
  'Kimi K2 Thinking': 'moonshotai/kimi-k2-thinking',
  // xAI
  'Grok 4.5': 'x-ai/grok-4.5',
  // 'Grok 4.3 Beta' is NOT mapped: Epoch evaluated a beta dated 2026-04-17 while
  // our x-ai/grok-4.3 entry is dated 2026-04-30. Beta and GA may or may not be
  // the same weights, and we cannot tell from either feed — so no number.
  'Grok 4.20': 'x-ai/grok-4.20',
  // DeepSeek
  'DeepSeek V4 Flash 0731': 'deepseek/deepseek-v4-flash-0731',
  'DeepSeek-V4-Pro': 'deepseek/deepseek-v4-pro',
  'DeepSeek-V3.2': 'deepseek/deepseek-v3.2',
  'DeepSeek-R1': 'deepseek/deepseek-r1',
  'DeepSeek-R1-Distill-Llama-70B': 'deepseek/deepseek-r1-distill-llama-70b',
  // Zhipu
  'GLM-5.2': 'z-ai/glm-5.2',
  'GLM-5.1': 'z-ai/glm-5.1',
  'GLM-5': 'z-ai/glm-5',
  'GLM-4.7': 'z-ai/glm-4.7',
  // Alibaba
  'Qwen3.7-Max': 'qwen/qwen3.7-max',
  'Qwen 3.6 Max (Preview)': 'qwen/qwen3.6-max-preview',
  'Qwen 3.6 Flash': 'qwen/qwen3.6-flash',
  'Qwen 3.6 Plus': 'qwen/qwen3.6-plus',
  'Qwen 3.8 Max': 'qwen/qwen3.8-max',
  'Qwen3-Max': 'qwen/qwen3-max',
  'Qwen3-235B-A22B': 'qwen/qwen3-235b-a22b',
  'Qwen2.5-72B': 'qwen/qwen-2.5-72b-instruct',   // NOT qwen2.5-vl-72b (vision variant)
  'Qwen Plus': 'qwen/qwen-plus',
  // Meta
  'Llama 4 Maverick': 'meta-llama/llama-4-maverick',
  'Llama 4 Scout': 'meta-llama/llama-4-scout',
  'Llama 3.3 70B': 'meta-llama/llama-3.3-70b-instruct',
  // Base Meta releases only. Epoch's "Llama 3.1-405B" has no Meta entry in our
  // catalogue — only nousresearch/hermes-3-llama-3.1-405b, a third-party
  // fine-tune — so it stays unmapped rather than borrowing someone else's scores.
  'Llama 3.1-70B': 'meta-llama/llama-3.1-70b-instruct',
  'Llama 3.1-8B': 'meta-llama/llama-3.1-8b-instruct',
  // Mistral
  'Mistral Large': 'mistralai/mistral-large',
  'Mistral Large 2': 'mistralai/mistral-large-2407',   // 2407 IS Large 2; 2512 is Large *3*
  'Mistral Medium 3': 'mistralai/mistral-medium-3',
  'Mistral Small 3': 'mistralai/mistral-small-24b-instruct-2501',   // display name is literally "Mistral Small 3"
  'Mistral Small 3.1': 'mistralai/mistral-small-3.1-24b-instruct',
  'Mixtral 8x22B': 'mistralai/mixtral-8x22b-instruct',
  'Mistral NeMo': 'mistralai/mistral-nemo',
  // Microsoft
  'Phi-4': 'microsoft/phi-4',
  'WizardLM-2 8x22B': 'microsoft/wizardlm-2-8x22b',
};

/**
 * DELIBERATELY LEFT UNMAPPED — checked 2026-08-06 against the live catalogue, do
 * not "fix" these without re-checking. They fall into three buckets:
 *
 *  1. NOT IN OUR CATALOGUE AT ALL (~59 names). Retired before OpenRouter's current
 *     listing: Claude 2 / 3 Opus / 3.5 Sonnet / 3.7 Sonnet, GPT-4.5, o1-mini,
 *     o1-preview, Gemini 1.0–2.0, Grok 2 / 3, Llama 2-70B and Llama 3-*, Mixtral
 *     8x7B, Mistral 7B, Qwen1.5-* / Qwen2-72B / Qwen-Turbo / QWQ-Plus, Yi-*, DBRX,
 *     phi-3-medium, Tulu 3, Magistral Small 1.0. Nothing to join to.
 *
 *  2. NEAR-NEIGHBOUR TRAPS — a same-family entry exists but is a DIFFERENT model:
 *       'Muse Spark'      vs meta/muse-spark-1.2                (the original trap)
 *       'Ministral 3B/8B' vs mistralai/ministral-{3b,8b}-2512   → "Ministral 3", Dec 2025
 *       'DeepSeek-V3'     vs deepseek/deepseek-v3.1/v3.2
 *       'Grok 4'          vs x-ai/grok-4.3 / 4.5 / 4.20
 *       'Llama 3.1-405B'  vs nousresearch/hermes-3-... (third-party fine-tune)
 *       'Qwen2.5-32B'     vs qwen/qwen-2.5-coder-32b (coder variant)
 *       'Gemini 3 Pro'    vs google/gemini-3-pro-image (image variant)
 *
 *  3. AMBIGUOUS SNAPSHOTS — the catalogue id is a moving alias, so two Epoch rows
 *     would collide on one id and `best` would silently keep the higher score:
 *     'GPT-4 (Mar 2023)' + 'GPT-4 (Jun 2023)' → openai/gpt-4;
 *     'GPT-4 Turbo (Nov 2023)' → openai/gpt-4-turbo-preview;
 *     'Gemini 2.5 Pro (Mar/May/Jun 2025)'; 'DeepSeek-R1 (May 2025)';
 *     'Claude 3.5 Sonnet (October 2024)'; 'Qwen3-235B-A22B (Jul 2025)'.
 */

// ── Model VERSION disambiguation ──────────────────────────────────────────────

/**
 * Epoch's `Model` column is NOT a unique key. `id_model_version` is, and the two
 * disagree in two very different ways:
 *
 *  a) EFFORT / CONTEXT VARIANTS of one model — `gpt-5.4-2026-03-05_{low,high,xhigh}`,
 *     `claude-opus-4-6_{32K,64K,max}`. Merging these is DELIBERATE: we keep the
 *     best score and record which variant produced it (see `variant` below).
 *
 *  b) GENUINELY DIFFERENT MODELS sharing a display name — `mistral-large-2407`
 *     vs `-2411` (two releases four months apart), `gemini-3.1-pro-preview` vs
 *     `-customtools` (a different harness, and a SEPARATE model in our own
 *     catalogue). Merging these is a BUG: `best` keeps the highest score per
 *     benchmark, so the record ends up with one snapshot's GPQA welded to
 *     another's SWE-bench — a model that never existed. Same class as the
 *     fake-7D bug: a number that looks authoritative and is not real.
 *
 * `versionBase()` strips (a) so only (b) survives as a difference.
 */
const EFFORT_SUFFIX = /_(?:none|minimal|low|medium|high|xhigh|max|promax|\d+K)$/;

function versionBase(v: string): string {
  // Trim FIRST. Without it a whitespace-only version normalizes to itself,
  // which is truthy, so an unidentifiable row sails through both gates.
  return (v || '').trim().replace(EFFORT_SUFFIX, '');
}

/**
 * Epoch model name → the ONE base version we accept, for names whose rows span
 * more than one. Explicit, like MODEL_MAP — a name with several base versions
 * and no pin here is DROPPED and reported in `ambiguous`, never merged.
 *
 * Each choice below is deliberate:
 *  • dated aliases pin to the NEWEST snapshot, because that is what OpenRouter's
 *    undated id (`openai/gpt-4o`) actually serves today;
 *  • 'Gemini 3.1 Pro' pins to the plain preview — the -customtools rows are a
 *    different OpenRouter model (google/gemini-3.1-pro-preview-customtools), so
 *    its SWE-bench score is not ours to attribute here;
 *  • 'Mistral Large 2' pins to 2407, matching our mistralai/mistral-large-2407;
 *  • 'DeepSeek-V3.2' pins to deepseek-chat because our deepseek/deepseek-v3.2
 *    carries isReasoning:false — deepseek-reasoner is the thinking mode.
 */
const VERSION_PIN: Record<string, string> = {
  'GPT-4o': 'gpt-4o-2024-11-20',
  'GPT-3.5 Turbo': 'gpt-3.5-turbo-0125',
  'Gemini 2.5 Flash': 'gemini-2.5-flash-preview-05-20',
  'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
  'Mistral Large 2': 'mistral-large-2407',
  'DeepSeek-V3.2': 'deepseek-chat',
  'Kimi K2.5': 'kimi-k2.5',            // vs fireworks/kimi-k2p5 — same weights, third-party host
  'GPT-5.5': 'gpt-5.5',                // vs gpt-5.5-pre-release
  'GPT-5.5 Pro': 'gpt-5.5-pro',        // vs gpt-5.5-pro-pre-release
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

/**
 * RFC-4180 CSV reader. Hand-rolled because Epoch's export embeds newlines AND
 * commas inside quoted fields (the "Training compute notes" column runs to
 * multiple paragraphs) — a naive split on \n yields 6541 fragments for 1107
 * actual records.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { quoted = true; }
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* swallow — \n handles the break */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else { field += ch; }
  }
  // Trailing record with no newline terminator.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows;
}

/**
 * Is this row's score usable? Shared by both passes so they can never disagree
 * about which rows count — a row that votes in the collision check but cannot
 * produce a score (or vice versa) is how a junk row suppresses a good model.
 */
function parseScore(row: string[], iBest: number, iMean: number): number | null {
  const raw = row[iBest] || (iMean >= 0 ? row[iMean] : '');
  const score = Number.parseFloat(raw);
  return Number.isFinite(score) && score >= 0 && score <= 1 ? score : null;
}

function hasUsableScore(row: string[], iBest: number, iMean: number): boolean {
  return parseScore(row, iBest, iMean) !== null;
}

// ── Fetch + normalize ─────────────────────────────────────────────────────────

export async function fetchBenchmarks(): Promise<BenchmarksPayload> {
  const res = await fetch(EPOCH_CSV, {
    headers: { 'User-Agent': 'token.app/1.0 (+https://token.app)' },
    cf: { cacheTtl: 1800, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`Epoch CSV ${res.status}`);

  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error('Epoch CSV: no data rows');

  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const iTask = col('original_task_name');
  const iTaskFallback = col('task');
  const iModel = col('Model');
  const iUnique = col('Unique display name');
  const iBest = col('best_score');
  const iMean = col('mean_score');
  const iStderr = col('stderr');
  const iStarted = col('started_at');
  const iVersion = col('id_model_version');

  if (iModel < 0 || iBest < 0) throw new Error('Epoch CSV: unexpected schema (missing Model/best_score)');
  // REQUIRED, not optional. Without it two different snapshots sharing a display
  // name are indistinguishable and the join silently re-creates the chimeras this
  // whole section exists to prevent. Throwing is the safe failure: refreshAllData
  // catches benchmark errors non-fatally, so KV keeps its last good payload and
  // `benchmarksError` surfaces the schema change instead of poisoning the data.
  if (iVersion < 0) throw new Error('Epoch CSV: unexpected schema (missing id_model_version)');

  const taskById = new Map(SURFACED.map((b) => [b.epochTask, b]));

  // PASS 1 — which base model versions does each mapped name span? Has to run
  // before any score is kept: whether a row is usable depends on rows that may
  // appear later in the file.
  const versionsByName = new Map<string, Set<string>>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length <= iModel) continue;
    const taskName = (iTask >= 0 ? row[iTask] : '') || (iTaskFallback >= 0 ? row[iTaskFallback] : '');
    if (!taskById.has(taskName)) continue;
    const epochModel = row[iModel]?.trim();
    if (!epochModel || !MODEL_MAP[epochModel]) continue;
    // A row that carries no usable score is not evidence of anything. Letting it
    // vote here means one junk row under a second version manufactures a
    // collision and suppresses a model that had a perfectly good score — failing
    // closed in the wrong direction. Same predicate as the scoring pass.
    if (!hasUsableScore(row, iBest, iMean)) continue;
    const base = versionBase(row[iVersion]);
    // A blank version is skipped HERE and rejected again in the scoring pass.
    // Skipping in only one pass is the fail-open bug: pass 1 would ignore the row
    // while pass 2 happily accepted it, letting an unidentifiable row through the
    // very gate it should never clear.
    if (!base) continue;
    let set = versionsByName.get(epochModel);
    if (!set) { set = new Set(); versionsByName.set(epochModel, set); }
    set.add(base);
  }

  const ambiguous: { model: string; versions: string[] }[] = [];
  const acceptedVersion = new Map<string, string>();

  // A PINNED name is gated on its pin ALWAYS — not merely when several versions
  // happen to appear in today's export. Gating only on a live collision leaves a
  // silent hole: if Epoch drops the older snapshot, `Mistral Large 2` stops
  // colliding and its 2411 rows would sail in under the 2407 id. If the pinned
  // version is gone, the name is dropped, not re-pointed.
  for (const [name, pin] of Object.entries(VERSION_PIN)) {
    if (!MODEL_MAP[name]) continue;
    const set = versionsByName.get(name);
    if (!set) continue;                     // name absent from this export — nothing to gate
    if (set.has(pin)) acceptedVersion.set(name, pin);
    else ambiguous.push({ model: name, versions: [...set].sort() });
  }

  // UNPINNED names are gated only when they actually collide — that is the
  // signal a pin is now needed, and it surfaces in `ambiguous` for the next PR.
  for (const [name, set] of versionsByName) {
    if (set.size <= 1 || VERSION_PIN[name]) continue;
    ambiguous.push({ model: name, versions: [...set].sort() });
  }

  const dropped = new Set(ambiguous.map((a) => a.model));

  // (modelId, benchmarkId) → best row seen. Epoch runs several effort variants
  // per model ("Claude Opus 5 (max)"); we keep the highest score and record which
  // variant produced it, so the number is never quietly averaged across configs.
  const best = new Map<string, BenchmarkScore & { _model: string; _epoch: string }>();
  // modelId → every raw id_model_version that contributed, winners and losers.
  const versionsSeen = new Map<string, Set<string>>();
  const unmapped = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length <= iModel) continue;

    const taskName = (iTask >= 0 ? row[iTask] : '') || (iTaskFallback >= 0 ? row[iTaskFallback] : '');
    const meta = taskById.get(taskName);
    if (!meta) continue;

    const epochModel = row[iModel]?.trim();
    if (!epochModel) continue;

    const modelId = MODEL_MAP[epochModel];
    if (!modelId) { unmapped.add(epochModel); continue; }

    // Version gate — see versionBase / VERSION_PIN above.
    if (dropped.has(epochModel)) continue;
    const rawVersion = row[iVersion] || '';
    const rowBase = versionBase(rawVersion);
    if (!rowBase) continue;                   // unidentifiable row — never scores
    const pinned = acceptedVersion.get(epochModel);
    if (pinned && rowBase !== pinned) continue;

    // Score is validated BEFORE the version is recorded, so `versions[]` only
    // ever lists ids that actually contributed a number.
    const score = parseScore(row, iBest, iMean);
    if (score === null) continue;

    // Record EVERY raw version that clears the gate, not just the ones that go
    // on to win their benchmark. Recording only winners defeats the purpose:
    // if two genuinely different models collapsed to one base, the loser is
    // exactly the evidence of the bad merge, and it would be the row dropped.
    let seen = versionsSeen.get(modelId);
    if (!seen) { seen = new Set(); versionsSeen.set(modelId, seen); }
    seen.add(rawVersion.trim());

    const stderrRaw = iStderr >= 0 ? Number.parseFloat(row[iStderr]) : NaN;
    const unique = iUnique >= 0 ? row[iUnique] : '';
    // "Claude Opus 5 (max)" → "max"
    const variantMatch = unique && unique !== epochModel ? /\(([^)]+)\)\s*$/.exec(unique) : null;
    const started = iStarted >= 0 ? row[iStarted] : '';

    const key = `${modelId} ${meta.id}`;
    const prev = best.get(key);
    if (prev && prev.score >= score) continue;

    best.set(key, {
      _model: modelId,
      _epoch: epochModel,
      benchmark: meta.label,
      benchmarkId: meta.id,
      score,
      stderr: Number.isFinite(stderrRaw) ? stderrRaw : null,
      isSelfReported: false,   // Epoch runs these itself — that is the point
      variant: variantMatch ? variantMatch[1] : null,
      recordedAt: started ? started.slice(0, 10) : null,
      source: 'Epoch AI',
      sourceUrl: ATTRIBUTION.url,
    });
  }

  const byModel = new Map<string, ModelBenchmarks>();
  const order = new Map(SURFACED.map((b, i) => [b.id, i]));
  for (const entry of best.values()) {
    const { _model, _epoch, ...score } = entry;
    let m = byModel.get(_model);
    if (!m) { m = { modelId: _model, epochModel: _epoch, scores: [], versions: [] }; byModel.set(_model, m); }
    m.scores.push(score);
  }
  for (const m of byModel.values()) {
    m.scores.sort((a, b) => (order.get(a.benchmarkId) ?? 99) - (order.get(b.benchmarkId) ?? 99));
    m.versions = [...(versionsSeen.get(m.modelId) ?? [])].sort();
  }

  return {
    models: [...byModel.values()].sort((a, b) => a.modelId.localeCompare(b.modelId)),
    benchmarks: SURFACED.map(({ id, label, blurb }) => ({ id, label, blurb })),
    unmapped: [...unmapped].sort(),
    ambiguous: ambiguous.sort((a, b) => a.model.localeCompare(b.model)),
    attribution: ATTRIBUTION,
    fetchedAt: new Date().toISOString(),
  };
}

// ── KV read ───────────────────────────────────────────────────────────────────

export async function readBenchmarks(env: Env): Promise<BenchmarksPayload | null> {
  const raw = await env.TOKEN_APP_KV.get(KV_KEYS.BENCHMARKS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BenchmarksPayload;
  } catch {
    return null;
  }
}
