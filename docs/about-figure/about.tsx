import { Connector, Stage } from '../../kit'
import deepseek from '../tokenapp-directions/logos/deepseek.svg'
import './about.css'

// The About page's figure: how one model's figures on token.app are made. Two
// sources on the left, each a small card showing what it really publishes; the
// result on the right, as the model page shows it.
//
// - OpenRouter publishes price per TOKEN, as a string ("0.000000059"); token.app
//   shows it per million ($0.059) and adds the blended figure nobody publishes,
//   which is why Blended is the one row without a leader.
// - Epoch AI publishes the score it ran itself, with its error bar.
// - One leader per fact, from the source's edge into the row it fills, across
//   the empty gutter, never over content.
//
// Real strings: the two sources and their raw values, the model, its four
// figures. Live data from token.app and Epoch AI, 2026-11-04.

export function TokenAppAbout({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <Stage width={720} height={300} theme={theme} className="tab">
      {(_, rect) => {
        const or = rect('or'), ep = rect('ep'), card = rect('card'), inR = rect('in'), outR = rect('out'), q = rect('q')
        const ready = or.width > 0 && card.width > 0
        const fromOr = { x: or.x + or.width + 6, y: or.y + or.height / 2 }
        return (
          <>
            <div className="tab-src tab-src--or" data-target="or">
              <div className="tab-src-name">OpenRouter <span>models API</span></div>
              <div className="tab-code"><span className="k">"prompt"</span>: <span className="v">"0.000000059"</span></div>
              <div className="tab-code"><span className="k">"completion"</span>: <span className="v">"0.0000003"</span></div>
            </div>

            <div className="tab-src tab-src--ep" data-target="ep">
              <div className="tab-src-name">Epoch AI <span>Benchmarking Hub</span></div>
              <div className="tab-code"><span className="k">GPQA Diamond</span>  <span className="v">0.910 ± 0.018</span></div>
            </div>

            <div className="tab-card" data-target="card">
              <div className="tab-head">
                <span className="tab-logo"><img src={deepseek} alt="" /></span>
                <span className="tab-model-text"><span className="tab-name">DeepSeek V4 Flash 0731</span><span className="tab-prov">DeepSeek · per 1M tokens</span></span>
              </div>
              <div className="tab-row" data-target="in"><span>Input</span><span className="num cheap">$0.059</span></div>
              <div className="tab-row" data-target="out"><span>Output</span><span className="num cheap">$0.300</span></div>
              <div className="tab-row"><span>Blended <span className="tab-dim">3:1 mix</span></span><span className="num cheap strong">$0.119</span></div>
              <div className="tab-row" data-target="q"><span>GPQA Diamond</span><span className="num">91.0% <span className="tab-dim">±1.8</span></span></div>
            </div>

            {ready && (
              <>
                <Connector show route="step" from={fromOr} to={{ x: card.x - 6, y: inR.y + inR.height / 2 }} />
                <Connector show route="step" from={fromOr} to={{ x: card.x - 6, y: outR.y + outR.height / 2 }} />
                <Connector show route="step" from={{ x: ep.x + ep.width + 6, y: ep.y + ep.height / 2 }} to={{ x: card.x - 6, y: q.y + q.height / 2 }} />
              </>
            )}
          </>
        )
      }}
    </Stage>
  )
}
