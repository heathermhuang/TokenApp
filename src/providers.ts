export interface ProviderMeta {
  displayName: string;
  color: string;      // text color (on dark bg)
  bgColor: string;    // chip background
  emoji?: string;     // optional icon
}

export const PROVIDERS: Record<string, ProviderMeta> = {
  openai:       { displayName: 'OpenAI',      color: '#10b981', bgColor: 'rgba(16,185,129,0.12)' },
  anthropic:    { displayName: 'Anthropic',   color: '#f97316', bgColor: 'rgba(249,115,22,0.12)' },
  google:       { displayName: 'Google',      color: '#60a5fa', bgColor: 'rgba(96,165,250,0.12)' },
  'meta-llama': { displayName: 'Meta',        color: '#818cf8', bgColor: 'rgba(129,140,248,0.12)' },
  mistralai:    { displayName: 'Mistral AI',  color: '#fb923c', bgColor: 'rgba(251,146,60,0.12)' },
  deepseek:     { displayName: 'DeepSeek',    color: '#38bdf8', bgColor: 'rgba(56,189,248,0.12)' },
  'x-ai':       { displayName: 'xAI',         color: '#e2e8f0', bgColor: 'rgba(226,232,240,0.10)' },
  cohere:       { displayName: 'Cohere',      color: '#4ade80', bgColor: 'rgba(74,222,128,0.12)' },
  perplexityai: { displayName: 'Perplexity',  color: '#a78bfa', bgColor: 'rgba(167,139,250,0.12)' },
  qwen:         { displayName: 'Alibaba',     color: '#fbbf24', bgColor: 'rgba(251,191,36,0.12)' },
  '01-ai':      { displayName: '01.ai',       color: '#94a3b8', bgColor: 'rgba(148,163,184,0.12)' },
  nvidia:       { displayName: 'NVIDIA',      color: '#76b900', bgColor: 'rgba(118,185,0,0.12)' },
  amazon:       { displayName: 'Amazon',      color: '#ff9900', bgColor: 'rgba(255,153,0,0.12)' },
  microsoft:    { displayName: 'Microsoft',   color: '#0078d4', bgColor: 'rgba(0,120,212,0.12)' },
  inflection:   { displayName: 'Inflection',  color: '#c084fc', bgColor: 'rgba(192,132,252,0.12)' },
  writer:       { displayName: 'Writer',      color: '#f472b6', bgColor: 'rgba(244,114,182,0.12)' },
  cursor:       { displayName: 'Cursor',      color: '#60a5fa', bgColor: 'rgba(96,165,250,0.12)' },
  windsurf:     { displayName: 'Windsurf',    color: '#38bdf8', bgColor: 'rgba(56,189,248,0.12)' },
  codeium:      { displayName: 'Codeium',     color: '#38bdf8', bgColor: 'rgba(56,189,248,0.12)' },
};

export function getProvider(id: string): ProviderMeta {
  const normalized = id.toLowerCase().replace(/\s+/g, '-');
  return PROVIDERS[normalized] ?? {
    displayName: capitalize(id.replace(/-/g, ' ')),
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.12)',
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
