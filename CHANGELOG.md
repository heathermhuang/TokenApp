# Changelog

All notable changes to token.app are documented here.

## [0.1.0.0] - 2026-03-23

### Added
- Real-time AI token pricing table via OpenRouter API (500+ models, 20+ providers)
- Provider logos (Google favicon service) in table rows and filter pills
- Active / Deprecated badges on every model row; deprecated rows visually dimmed with strikethrough
- "Deprecated" filter tab in category tabs
- Subscription pricing cards for ChatGPT, Claude, Gemini, Copilot, Cursor, and more
- Provider filter pills with per-provider model counts
- Sort by Released (default, newest first), Context, Input/Output price
- Category filters: All, Text, Vision, Audio, Reasoning, Free, Open Source, Deprecated
- Google Analytics GA4 with Consent Mode v2 (analytics blocked by default until accept)
- Cookie consent bar (fixed bottom, non-overlapping via dynamic padding-bottom)
- Terms of Use and Privacy Policy modals
- "Powered by Measurable AI" footer with Terms/Privacy links
- Hourly auto-refresh via Cloudflare Cron Trigger
- Cloudflare Workers + KV caching for sub-10ms response times
- Deployed at token.app and token-app.measurable.workers.dev
