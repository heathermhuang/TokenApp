# Contributing to token.app

Thanks for your interest in contributing. Here's how to get involved.

## Quick start

```bash
git clone https://github.com/heathermhuang/TokenApp.git
cd TokenApp
npm install
npm run dev    # starts local dev server at http://localhost:8787
```

You'll need a Cloudflare account (free tier) and a KV namespace. See [README.md](README.md#setup) for full setup instructions.

## What to work on

**Adding or updating subscription data** -- the most common contribution. Edit `src/subscriptions.ts` to add new AI products or update pricing/tiers. Include the official pricing page URL as the `url` field.

**Adding provider metadata** -- if models from a new provider appear on OpenRouter but show no logo or link, add entries to the `PROVIDER_DOMAINS`, `PROVIDER_URLS`, and `MODEL_PAGE_URLS` maps in `src/template.ts` and `src/providers.ts`.

**Bug fixes** -- if you find a rendering issue, broken link, or incorrect data, open an issue or submit a PR directly.

**Feature ideas** -- open an issue to discuss before building. This keeps the project focused and avoids wasted effort.

## Code style

- TypeScript, strict mode
- No frontend framework -- all rendering is template strings in `template.ts`
- No build step for the frontend -- the Worker serves raw HTML/CSS/JS
- Keep dependencies minimal (currently only `hono`)
- Use `var` in client-side JS inside template literals (avoids template literal escaping issues with `const`/`let` in some contexts)

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally with `npm run dev`
4. Submit a PR with a clear description of what changed and why

Keep PRs focused. One feature or fix per PR. If you're touching multiple areas, split them up.

## Reporting issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Browser/device if it's a rendering issue
- Screenshots if relevant

## Security issues

Do not open a public issue for security vulnerabilities. Email [hello@measurable.ai](mailto:hello@measurable.ai) instead.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
