// Price normalized UsageEvents against the live NormalizedModel price table,
// then roll them up into the shapes the dashboard renders. Pure function file —
// takes data in, returns data out, no I/O. The same code runs server-side
// (for SSR testing / `/api/usage/preview`) and client-side (inlined).

import type { UsageEvent, NormalizedModel, Subscription } from './types';

export interface PricedEvent extends UsageEvent {
  effectiveCostUSD: number;      // cost we'll chart (costUSD if given, else computed)
  computedCostUSD: number | null;// cost computed from list price (may differ from costUSD)
  listInputPer1M: number | null;
  listOutputPer1M: number | null;
  modelMatched: boolean;         // did we find this model in the price table?
}

export interface DashboardData {
  totals: {
    events: number;
    daysCovered: number;
    firstDay: string | null;
    lastDay: string | null;
    totalCostUSD: number;
    computedCostUSD: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    requests: number;
  };
  spendOverTime: Array<{ day: string; costUSD: number; inputTokens: number; outputTokens: number }>;
  byModel: Array<{
    modelId: string;
    provider: string;
    displayName: string;
    costUSD: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    effectiveInputPer1M: number | null;  // (cost attributable to input) / (input/1M) — real rate you paid
    effectiveOutputPer1M: number | null;
    listInputPer1M: number | null;
    listOutputPer1M: number | null;
    matched: boolean;
  }>;
  byProvider: Array<{ providerId: string; costUSD: number; share: number }>;
  subBreakeven: Array<{
    subscriptionId: string;
    subscriptionName: string;
    tierName: string;
    monthlyPriceUSD: number;
    monthsCoveredByAPISpend: number;  // totalCost / monthlyPrice
    matchesUnderlyingModels: boolean; // whether user's top models overlap with the sub
  }>;
  cheaperEquivalents: Array<{
    yourModelId: string;
    yourProvider: string;
    yourCostUSD: number;
    alternativeId: string;
    alternativeProvider: string;
    alternativeCostUSD: number;
    savingsUSD: number;
    savingsPct: number;
    caveat: string;
  }>;
  unmatchedModels: string[];  // models in usage that we couldn't price
}

// ── Core pricing ─────────────────────────────────────────────────────────────

// Generate candidate forms of a slug to handle the dash↔dot version ambiguity
// LLMs produce in the wild. Anthropic's canonical ids use dots ("claude-sonnet-4.5"),
// but model cards and older APIs often render the same version as dashes
// ("claude-sonnet-4-5"). We accept either and resolve to the canonical price row.
function slugCandidates(slug: string): string[] {
  const s = slug.toLowerCase();
  const out = new Set<string>([s]);
  // "-4-5" → "-4.5" (treat dash-digit pairs as version separators)
  out.add(s.replace(/-(\d+)-(\d+)(?=$|[-:])/g, '-$1.$2'));
  // "-4.5" → "-4-5"
  out.add(s.replace(/-(\d+)\.(\d+)(?=$|[-:])/g, '-$1-$2'));
  return Array.from(out);
}

// Collapse every version separator to a single canonical form so that
// "claude-sonnet-4-5", "claude-sonnet-4.5", and "claude-sonnet-4_5" all compare
// equal. Used as a last-resort fallback — the targeted slugCandidates above
// handle the common cases; this catches anything the regex missed (odd
// positions, stacked versions, underscores, etc.).
function canonVersion(slug: string): string {
  return slug.toLowerCase().replace(/(\d+)[-._](\d+)/g, '$1.$2');
}

function findModel(modelId: string, provider: string, models: NormalizedModel[]): NormalizedModel | null {
  // Try provider/id exact, then id alone across providers.
  const pNorm = provider.toLowerCase();
  const mCandidates = slugCandidates(modelId);

  // Exact match on full id (e.g. "openai/gpt-4o")
  for (const m of mCandidates) {
    const byFull = models.find(x => x.id.toLowerCase() === `${pNorm}/${m}`);
    if (byFull) return byFull;
  }

  // Slug match within provider
  const inProvider = models.filter(m => m.providerId.toLowerCase() === pNorm);
  for (const m of mCandidates) {
    const bySlugInProv = inProvider.find(x => x.slug.toLowerCase() === m);
    if (bySlugInProv) return bySlugInProv;
  }

  // Version-separator-insensitive match within provider. Handles cases where
  // the user pasted "claude-sonnet-4-5" but the OpenRouter price table has
  // migrated to "claude-sonnet-4.5" (or vice versa). Prefer the shortest slug
  // to avoid latching onto a variant like ":thinking".
  const targetCanon = canonVersion(modelId);
  const canonInProv = inProvider
    .filter(x => canonVersion(x.slug) === targetCanon)
    .sort((a, b) => a.slug.length - b.slug.length)[0];
  if (canonInProv) return canonInProv;

  // Slug prefix within provider
  for (const m of mCandidates) {
    const bySlugPrefix = inProvider
      .filter(x => x.slug.toLowerCase() === m || x.slug.toLowerCase().startsWith(m + '-'))
      .sort((a, b) => a.slug.length - b.slug.length)[0];
    if (bySlugPrefix) return bySlugPrefix;
  }

  // Cross-provider slug match — last resort
  for (const m of mCandidates) {
    const anySlug = models.find(x => x.slug.toLowerCase() === m);
    if (anySlug) return anySlug;
  }

  // Cross-provider canonical-version match — final fallback
  const canonAny = models
    .filter(x => canonVersion(x.slug) === targetCanon)
    .sort((a, b) => a.slug.length - b.slug.length)[0];
  if (canonAny) return canonAny;

  return null;
}

export function priceEvent(event: UsageEvent, models: NormalizedModel[]): PricedEvent {
  const matched = findModel(event.modelId, event.provider, models);

  let computed: number | null = null;
  if (matched && event.inputTokens != null && event.outputTokens != null) {
    const input = (matched.inputPer1M ?? 0) * (event.inputTokens / 1_000_000);
    const output = (matched.outputPer1M ?? 0) * (event.outputTokens / 1_000_000);
    // Cached input tokens typically billed at 10% of list price — approximate.
    const cached = (matched.inputPer1M ?? 0) * 0.1 * ((event.cachedInputTokens ?? 0) / 1_000_000);
    computed = round4(input + output + cached);
  }

  const effective = event.costUSD != null ? event.costUSD : (computed ?? 0);

  return {
    ...event,
    // Canonicalize so dash/dot variants of the same model aggregate together.
    modelId: matched?.slug ?? event.modelId,
    provider: matched?.providerId ?? event.provider,
    effectiveCostUSD: effective,
    computedCostUSD: computed,
    listInputPer1M: matched?.inputPer1M ?? null,
    listOutputPer1M: matched?.outputPer1M ?? null,
    modelMatched: !!matched,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Dashboard aggregation ────────────────────────────────────────────────────

export function buildDashboard(
  events: UsageEvent[],
  models: NormalizedModel[],
  subscriptions: Subscription[]
): DashboardData {
  const priced = events.map(e => priceEvent(e, models));

  const totals = {
    events: priced.length,
    daysCovered: 0,
    firstDay: null as string | null,
    lastDay: null as string | null,
    totalCostUSD: 0,
    computedCostUSD: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    requests: 0,
  };

  const days = new Set<string>();
  const byDay: Record<string, { costUSD: number; inputTokens: number; outputTokens: number }> = {};
  const byModelMap: Record<string, DashboardData['byModel'][number]> = {};
  const byProviderMap: Record<string, number> = {};
  const unmatched = new Set<string>();

  for (const p of priced) {
    const day = p.ts.slice(0, 10);
    days.add(day);
    totals.totalCostUSD += p.effectiveCostUSD;
    if (p.computedCostUSD != null) totals.computedCostUSD += p.computedCostUSD;
    totals.inputTokens += p.inputTokens ?? 0;
    totals.outputTokens += p.outputTokens ?? 0;
    totals.cachedInputTokens += p.cachedInputTokens ?? 0;
    totals.requests += p.requests ?? 0;

    if (!byDay[day]) byDay[day] = { costUSD: 0, inputTokens: 0, outputTokens: 0 };
    byDay[day].costUSD += p.effectiveCostUSD;
    byDay[day].inputTokens += p.inputTokens ?? 0;
    byDay[day].outputTokens += p.outputTokens ?? 0;

    const key = `${p.provider}/${p.modelId}`;
    if (!byModelMap[key]) {
      byModelMap[key] = {
        modelId: p.modelId,
        provider: p.provider,
        displayName: p.modelId,
        costUSD: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        effectiveInputPer1M: null,
        effectiveOutputPer1M: null,
        listInputPer1M: p.listInputPer1M,
        listOutputPer1M: p.listOutputPer1M,
        matched: p.modelMatched,
      };
    }
    const row = byModelMap[key];
    row.costUSD += p.effectiveCostUSD;
    row.inputTokens += p.inputTokens ?? 0;
    row.outputTokens += p.outputTokens ?? 0;
    row.requests += p.requests ?? 0;

    byProviderMap[p.provider] = (byProviderMap[p.provider] ?? 0) + p.effectiveCostUSD;

    if (!p.modelMatched) unmatched.add(`${p.provider}/${p.modelId}`);
  }

  // Effective $/1M — what the user actually paid per million tokens. Only
  // computed when we know both tokens and cost; otherwise null.
  for (const row of Object.values(byModelMap)) {
    if (row.inputTokens > 0 && row.listInputPer1M != null && row.listOutputPer1M != null) {
      // Split total cost proportionally between input and output by list-price weight,
      // then divide each by its token count for the effective rate.
      const inWeight = row.listInputPer1M * row.inputTokens;
      const outWeight = row.listOutputPer1M * row.outputTokens;
      const totalWeight = inWeight + outWeight;
      if (totalWeight > 0) {
        const inputCost = row.costUSD * (inWeight / totalWeight);
        const outputCost = row.costUSD * (outWeight / totalWeight);
        row.effectiveInputPer1M = round4(inputCost / (row.inputTokens / 1_000_000));
        if (row.outputTokens > 0) {
          row.effectiveOutputPer1M = round4(outputCost / (row.outputTokens / 1_000_000));
        }
      }
    }
  }

  totals.daysCovered = days.size;
  const sortedDays = Array.from(days).sort();
  totals.firstDay = sortedDays[0] ?? null;
  totals.lastDay = sortedDays[sortedDays.length - 1] ?? null;
  totals.totalCostUSD = round4(totals.totalCostUSD);
  totals.computedCostUSD = round4(totals.computedCostUSD);

  const spendOverTime = sortedDays.map(day => ({
    day,
    costUSD: round4(byDay[day].costUSD),
    inputTokens: byDay[day].inputTokens,
    outputTokens: byDay[day].outputTokens,
  }));

  const byModel = Object.values(byModelMap)
    .map(r => ({ ...r, costUSD: round4(r.costUSD) }))
    .sort((a, b) => b.costUSD - a.costUSD);

  const byProvider = Object.entries(byProviderMap)
    .map(([providerId, costUSD]) => ({
      providerId,
      costUSD: round4(costUSD),
      share: totals.totalCostUSD > 0 ? costUSD / totals.totalCostUSD : 0,
    }))
    .sort((a, b) => b.costUSD - a.costUSD);

  // ── Subscription breakeven ──────────────────────────────────────────────
  // Normalize to a monthly rate. If the data covers < 7 days, we skip —
  // extrapolation from a 2-day sample gives comically wrong recommendations.
  const monthlyCostEstimate = totals.daysCovered >= 7 && totals.firstDay && totals.lastDay
    ? totals.totalCostUSD / totals.daysCovered * 30
    : totals.totalCostUSD;

  const topModelIds = new Set(byModel.slice(0, 5).map(m => m.modelId));

  const subBreakeven: DashboardData['subBreakeven'] = [];
  for (const sub of subscriptions) {
    for (const tier of sub.tiers) {
      const price = tier.monthlyPrice;
      if (price == null || price <= 0) continue;
      const matchesUnderlying = !!sub.underlyingModels?.some(m => topModelIds.has(normalizeForMatch(m)));
      subBreakeven.push({
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        tierName: tier.name,
        monthlyPriceUSD: price,
        monthsCoveredByAPISpend: monthlyCostEstimate > 0 ? round4(monthlyCostEstimate / price) : 0,
        matchesUnderlyingModels: matchesUnderlying,
      });
    }
  }
  // Most interesting: sub tiers whose underlying models the user actually uses,
  // sorted by how much of their spend would flip.
  subBreakeven.sort((a, b) => {
    if (a.matchesUnderlyingModels !== b.matchesUnderlyingModels) return a.matchesUnderlyingModels ? -1 : 1;
    return b.monthsCoveredByAPISpend - a.monthsCoveredByAPISpend;
  });

  // ── Cheaper equivalents ─────────────────────────────────────────────────
  // For each top model with real spend, find the cheapest same-provider or
  // same-tier model that supports the same modality/reasoning. Heuristic —
  // we label it clearly as a hint, not a decision.
  const cheaperEquivalents: DashboardData['cheaperEquivalents'] = [];
  for (const m of byModel.slice(0, 5)) {
    if (!m.matched || m.costUSD < 1) continue;
    const yourModel = models.find(x => x.providerId.toLowerCase() === m.provider.toLowerCase() && x.slug.toLowerCase() === m.modelId.toLowerCase());
    if (!yourModel || yourModel.inputPer1M == null || yourModel.outputPer1M == null) continue;

    // Candidates: any model with ≤ half the blended price that supports the same input modalities.
    const yourBlended = (yourModel.inputPer1M + yourModel.outputPer1M * 3) / 4; // output weighted higher (typical 3:1 ratio)
    const candidates = models
      .filter(c => {
        if (c.id === yourModel.id) return false;
        if (c.inputPer1M == null || c.outputPer1M == null) return false;
        if (c.isDeprecated) return false;
        const blended = (c.inputPer1M + c.outputPer1M * 3) / 4;
        if (blended >= yourBlended * 0.5) return false;
        if (yourModel.isVision && !c.isVision) return false;
        if (yourModel.isReasoning && !c.isReasoning) return false;
        return true;
      })
      .sort((a, b) => {
        // Prefer same provider (lower switching cost), then cheapest blended
        const sameA = a.providerId === yourModel.providerId ? 0 : 1;
        const sameB = b.providerId === yourModel.providerId ? 0 : 1;
        if (sameA !== sameB) return sameA - sameB;
        const aB = (a.inputPer1M! + a.outputPer1M! * 3) / 4;
        const bB = (b.inputPer1M! + b.outputPer1M! * 3) / 4;
        return aB - bB;
      });

    const alt = candidates[0];
    if (!alt) continue;

    // Estimate cost with the alternative using the same token mix
    const altCost = (alt.inputPer1M! * (m.inputTokens / 1_000_000)) + (alt.outputPer1M! * (m.outputTokens / 1_000_000));
    const savings = m.costUSD - altCost;
    if (savings <= 0) continue;

    cheaperEquivalents.push({
      yourModelId: yourModel.id,
      yourProvider: yourModel.providerId,
      yourCostUSD: round4(m.costUSD),
      alternativeId: alt.id,
      alternativeProvider: alt.providerId,
      alternativeCostUSD: round4(altCost),
      savingsUSD: round4(savings),
      savingsPct: round4(savings / m.costUSD),
      caveat: alt.providerId !== yourModel.providerId
        ? 'Cross-provider switch — evaluate quality on your workload first.'
        : 'Same provider — smaller model may lack reasoning or context depth.',
    });
  }
  cheaperEquivalents.sort((a, b) => b.savingsUSD - a.savingsUSD);

  return {
    totals,
    spendOverTime,
    byModel,
    byProvider,
    subBreakeven: subBreakeven.slice(0, 6),
    cheaperEquivalents: cheaperEquivalents.slice(0, 3),
    unmatchedModels: Array.from(unmatched).sort(),
  };
}

function normalizeForMatch(id: string): string {
  return id.toLowerCase().replace(/^.+?\//, '');
}
