import type { AppCategory } from './types';

// OpenRouter app categories, enumerated from sitemap.xml in the 2026-06-22 spike
// (docs/superpowers/specs/2026-06-22-rankings-spike-findings.md). Slugs + groups
// are the authoritative scrape targets; labels are seeds — the daily scraper
// overwrites each with the live <h1> label from the rendered page.
export const APP_CATEGORIES: AppCategory[] = [
  { group: 'coding',        slug: 'cli-agent',          label: 'CLI Agents' },
  { group: 'coding',        slug: 'cloud-agent',        label: 'Cloud Agents' },
  { group: 'coding',        slug: 'ide-extension',      label: 'IDE Extensions' },
  { group: 'coding',        slug: 'native-app-builder', label: 'Native App Builders' },
  { group: 'coding',        slug: 'programming-app',    label: 'Programming App' },
  { group: 'creative',      slug: 'audio-gen',          label: 'Audio Generation' },
  { group: 'creative',      slug: 'creative-writing',   label: 'Creative Writing' },
  { group: 'creative',      slug: 'image-gen',          label: 'Image Generation' },
  { group: 'creative',      slug: 'video-gen',          label: 'Video Generation' },
  { group: 'entertainment', slug: 'game',               label: 'Game' },
  { group: 'entertainment', slug: 'roleplay',           label: 'Roleplay' },
  { group: 'productivity',  slug: 'general-chat',       label: 'General Chat' },
  { group: 'productivity',  slug: 'legal',              label: 'Legal' },
  { group: 'productivity',  slug: 'personal-agent',     label: 'Personal Agents' },
  { group: 'productivity',  slug: 'writing-assistant',  label: 'Writing Assistants' },
];

// Soft cap so a future OpenRouter UI change can't make the daily job unbounded.
export const CATEGORY_SCRAPE_CAP = 20;

export const CATEGORY_SLUGS = new Set(APP_CATEGORIES.map((c) => c.slug));
export const CATEGORY_LABELS = new Map(APP_CATEGORIES.map((c) => [c.slug, c.label] as const));

export function categoryUrl(c: AppCategory): string {
  return `https://openrouter.ai/apps/category/${c.group}/${c.slug}`;
}
