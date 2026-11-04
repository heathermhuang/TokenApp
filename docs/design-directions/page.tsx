import { Stage } from '../../kit'
import './page.css'
import anthropic from './logos/anthropic.svg'
import openai from './logos/openai.svg'
import google from './logos/google.svg'
import deepseek from './logos/deepseek.svg'
import moonshot from './logos/moonshotai.svg'
import qwen from './logos/qwen.svg'

// token.app's homepage, top of the page, at 1200 wide: the same content in
// three looks so the directions compare identity, not layout. Every value is
// live data from token.app on 2026-11-04 (models API + Epoch benchmarks).
//
// The structure is the proposal shared by all three: a shorter hero, the
// stat row folded into one line, the three picks as one strip, the filters in
// one toolbar, and the table as the page's main object.

type Row = {
  name: string; slug: string; provider: string; logo: string; mono?: 1
  released: string; ctx: string; input: string; output: string; blended: string; cached: string; gpqa?: string
}

const ROWS: Row[] = [
  { name: 'Claude Sonnet 5.5', slug: 'claude-sonnet-5.5', provider: 'Anthropic', logo: anthropic, mono: 1, released: 'Sep 2026', ctx: '1.0M', input: '$2.00', output: '$10.00', blended: '$4.00', cached: '$0.10' },
  { name: 'Claude Opus 5.5', slug: 'claude-opus-5.5', provider: 'Anthropic', logo: anthropic, mono: 1, released: 'Sep 2026', ctx: '1.0M', input: '$4.00', output: '$20.00', blended: '$8.00', cached: '$0.20' },
  { name: 'Gemini 3.7 Flash', slug: 'gemini-3.7-flash', provider: 'Google', logo: google, released: 'Aug 2026', ctx: '1.0M', input: '$0.750', output: '$3.75', blended: '$1.50', cached: '$0.075', gpqa: '94.8%' },
  { name: 'DeepSeek V4 Flash 0731', slug: 'deepseek-v4-flash-0731', provider: 'DeepSeek', logo: deepseek, released: 'Jul 2026', ctx: '1.0M', input: '$0.059', output: '$0.300', blended: '$0.119', cached: '$0.035', gpqa: '91.0%' },
  { name: 'Qwen3.7 Flash', slug: 'qwen3.7-flash', provider: 'Alibaba', logo: qwen, released: 'Jul 2026', ctx: '1.0M', input: '$0.030', output: '$0.130', blended: '$0.055', cached: '$0.006', gpqa: '82.3%' },
  { name: 'Kimi K3', slug: 'kimi-k3', provider: 'Moonshot AI', logo: moonshot, mono: 1, released: 'Jul 2026', ctx: '1.0M', input: '$0.200', output: '$16.00', blended: '$4.15', cached: '$0.190', gpqa: '93.1%' },
  { name: 'GPT-5.6 Sol', slug: 'gpt-5.6-sol', provider: 'OpenAI', logo: openai, mono: 1, released: 'Jul 2026', ctx: '1.1M', input: '$4.00', output: '$20.00', blended: '$8.00', cached: '$0.400', gpqa: '93.5%' },
]

const cheap = (p: string) => parseFloat(p.slice(1)) < 0.5

export function TokenAppPage({ look, theme }: { look: string; theme: 'dark' | 'light' }) {
  return (
    <Stage width={1200} height={876} theme={theme} className={`tad tad-${look}`}>
      {() => (
        <div className="tad-page">
          <div className="tad-nav">
            <div className="tad-mark"><span className="tad-glyph" aria-hidden="true">◈</span>token.app</div>
            <div className="tad-links"><span className="is-on">Models</span><span>Subscriptions</span><span>Rankings</span><span>About</span></div>
            <div className="tad-status"><span className="tad-live" />Updated 33m ago</div>
          </div>

          <div className="tad-hero">
            <div className="tad-h1">AI model pricing, <em>side by side</em></div>
            <div className="tad-sub">Live per-token prices for 454 models from 60 providers, next to benchmarks Epoch AI runs itself.</div>
          </div>

          <div className="tad-picks">
            <div className="tad-pick">
              <div className="tad-k">Best value</div>
              <div className="tad-big">$0.119</div>
              <div className="tad-name">DeepSeek V4 Flash 0731</div>
              <div className="tad-meta">per 1M blended · 91.0% GPQA</div>
            </div>
            <div className="tad-pick">
              <div className="tad-k">Best open weights</div>
              <div className="tad-big">93.1%</div>
              <div className="tad-name">Kimi K3</div>
              <div className="tad-meta">GPQA Diamond · $4.15 per 1M</div>
            </div>
            <div className="tad-pick">
              <div className="tad-k">Largest context</div>
              <div className="tad-big">2M</div>
              <div className="tad-name">Grok 4.20 Multi-Agent</div>
              <div className="tad-meta">tokens · $1.56 per 1M</div>
            </div>
          </div>

          <div className="tad-toolbar">
            <div className="tad-search"><span className="tad-search-icon" aria-hidden="true" />Search 454 models</div>
            <div className="tad-seg">
              {['All', 'Text', 'Vision', 'Reasoning', 'Free', 'Open weights'].map((t, i) => (
                <span key={t} className={i === 0 ? 'is-on' : ''}>{t}</span>
              ))}
            </div>
            <div className="tad-select">All providers<span className="tad-caret" aria-hidden="true" /></div>
            <div className="tad-select">GPQA Diamond<span className="tad-caret" aria-hidden="true" /></div>
          </div>

          <div className="tad-table">
            <div className="tad-tr tad-th">
              <span>Model</span><span>Released ↓</span><span className="r">Context</span><span className="r">Input</span>
              <span className="r">Output</span><span className="r">Blended</span><span className="r">Cached</span><span className="r">GPQA</span>
            </div>
            {ROWS.slice(0, 6).map((r) => (
              <div key={r.slug} className="tad-tr">
                <span className="tad-model">
                  <span className="tad-logo"><img className={r.mono ? 'is-mono' : ''} src={r.logo} alt="" /></span>
                  <span className="tad-model-text"><span className="tad-model-name">{r.name}</span><span className="tad-model-prov">{r.provider}</span></span>
                </span>
                <span className="tad-dim">{r.released}</span>
                <span className="r num">{r.ctx}</span>
                <span className={`r num${cheap(r.input) ? ' is-cheap' : ''}`}>{r.input}</span>
                <span className={`r num${cheap(r.output) ? ' is-cheap' : ''}`}>{r.output}</span>
                <span className={`r num strong${cheap(r.blended) ? ' is-cheap' : ''}`}>{r.blended}</span>
                <span className="r num tad-dim">{r.cached}</span>
                <span className="r num">{r.gpqa ?? <span className="tad-dim">—</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Stage>
  )
}
