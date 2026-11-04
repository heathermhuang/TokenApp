import { Stage, Text } from '../../kit'
import './og.css'

// token.app's social card (/og.png): a 1200 × 630 still, filmed at 2x from a
// 600 × 315 stage. Opposite corners: the wordmark top-left, the headline
// bottom-left, and the product's own "Price vs Quality" card hung off the
// top-right corner, off the top and right edges.
//
// The story is the product's one question: which model gives the most
// quality per dollar. The card answers it the way the site does: the
// frontier staircase through the scatter, and the "Best value" readout with
// its blended price as the one big number.
//
// The dots, colors and frontier are token.app's live chart (GPQA Diamond,
// 85 models, 2026-11-03), in the chart's own 880 × 420 coordinates, so the
// picture is the real distribution rather than an invented one.
//
// Real strings: the wordmark, the headline and its line, "Best value", the
// model, its price and score. Axis ticks are the product's own.

type Dot = [x: number, y: number, color: string, frontier?: 1]

const DOTS: Dot[] = [
  [52, 325.4, '#fb923c', 1], [118, 95.5, '#fbbf24', 1], [118, 189.9, '#10b981'], [122.7, 338.3, '#818cf8'],
  [166.6, 210.7, '#60a5fa'], [194.1, 95.5, '#fbbf24'], [199, 57.3, '#38bdf8', 1], [213.9, 152, '#10b981'],
  [221.2, 247.2, '#60a5fa'], [223, 229.2, '#818cf8'], [239.1, 242, '#10b981'], [276.4, 124.3, '#60a5fa'],
  [281.5, 291.1, '#10b981'], [281.5, 124.3, '#10b981'], [288.3, 248.5, '#818cf8'], [291.9, 144.2, '#38bdf8'],
  [295.5, 84.4, '#fbbf24'], [296.8, 162.8, '#818cf8'], [317.4, 241, '#fbbf24'], [322.9, 245.6, '#fbbf24'],
  [331.2, 91.1, '#fbbf24'], [337.9, 54.8, '#10b981', 1], [340.8, 112.4, '#10b981'], [349.4, 160, '#38bdf8'],
  [354, 57.9, '#a78bfa'], [360.8, 71.2, '#fbbf24'], [361.2, 97.7, '#60a5fa'], [365.3, 84.4, '#fbbf24'],
  [374.3, 68.4, '#94a3b8'], [376.4, 296.5, '#60a5fa'], [382.2, 127.6, '#10b981'], [384.1, 167.8, '#10b981'],
  [387.1, 262.7, '#818cf8'], [388.7, 68.9, '#fbbf24'], [398.1, 195.4, '#fb923c'], [404.4, 91.1, '#60a5fa'],
  [411.8, 121.8, '#38bdf8'], [421.4, 91.1, '#818cf8'], [422.7, 80, '#fbbf24'], [429, 87.2, '#e2e8f0'],
  [433.7, 64.5, '#60a5fa'], [446.8, 77.8, '#fbbf24'], [450.9, 71.2, '#e2e8f0'], [452, 58.4, '#e2e8f0'],
  [463.8, 40.7, '#60a5fa', 1], [467.3, 71.4, '#818cf8'], [468.1, 64.8, '#e2e8f0'], [476.2, 75.6, '#10b981'],
  [477.2, 53.7, '#818cf8'], [480.7, 69.5, '#94a3b8'], [493.9, 57.9, '#38bdf8'], [493.9, 144.2, '#f97316'],
  [501.5, 62.3, '#818cf8'], [504.5, 57.9, '#fbbf24'], [536.3, 44.3, '#e2e8f0'], [536.3, 241.5, '#fb923c'],
  [536.3, 307.1, '#fb923c'], [536.3, 286.5, '#fb923c'], [548.7, 49.6, '#60a5fa'], [550.6, 72.3, '#10b981'],
  [550.6, 82.5, '#60a5fa'], [552.5, 97.7, '#10b981'], [552.5, 163.1, '#10b981'], [563.6, 48.2, '#e2e8f0'],
  [566.4, 59.5, '#f97316'], [575.8, 246.5, '#10b981'], [578.7, 42.4, '#60a5fa'], [585.8, 55.7, '#10b981'],
  [602.1, 47.4, '#10b981'], [608.8, 73.4, '#f97316'], [608.8, 95.5, '#f97316'], [638.9, 46.5, '#10b981'],
  [662.3, 44.9, '#f97316'], [662.3, 61.2, '#f97316'], [662.3, 79.2, '#f97316'], [674.6, 59, '#10b981'],
  [734.8, 80, '#f97316'], [777.2, 117.7, '#f97316'],
]
const FRONTIER = 'M 52 325.4 L 118 325.4 L 118 95.5 L 199 95.5 L 199 57.3 L 337.9 57.3 L 337.9 54.8 L 463.8 54.8 L 463.8 40.7'
const Y_TICKS: [string, number][] = [['35%', 306.3], ['68%', 163.9], ['100%', 21.5]]
const X_TICKS: [string, number][] = [['$0.10', 180.6], ['$1.00', 421.4], ['$10', 662.3]]

function Plot() {
  return (
    <svg className="og-plot" viewBox="12 6 720 396" aria-hidden="true">
      {[306.3, 235.1, 163.9, 92.7, 21.5].map((y) => <line key={y} className="og-grid" x1={52} x2={862} y1={y} y2={y} />)}
      <line className="og-axis" x1={52} x2={862} y1={374} y2={374} />
      <line className="og-axis" x1={52} x2={52} y1={18} y2={374} />
      {Y_TICKS.map(([t, y]) => <text key={t} className="og-tick" x={44} y={y + 4} textAnchor="end">{t}</text>)}
      {X_TICKS.map(([t, x]) => <text key={t} className="og-tick" x={x} y={394} textAnchor="middle">{t}</text>)}
      <path className="og-frontier" d={FRONTIER} />
      {/* A hairline from the readout above down to the dot it names */}
      <line className="og-leader" x1={199} x2={199} y1={0} y2={47} />
      {DOTS.filter((d) => !d[3]).map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r={5} fill={c} className="og-dot" />)}
      {DOTS.filter((d) => d[3]).map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r={x === 199 ? 9 : 7} fill={c} className="og-dot og-dot--frontier" />)}
    </svg>
  )
}

export default function TokenAppOg() {
  return (
    <Stage width={600} height={315} theme="dark" className="og">
      {() => (
        <>
          <div className="og-mark">
            {/* The site's own mark: the ◈ glyph in the accent, as its nav draws it */}
            <span className="og-glyph" aria-hidden="true">◈</span>
            <Text className="og-word">token.app</Text>
          </div>

          <div className="og-card">
            <div className="og-read">
              <Text className="og-k">Best value · GPQA Diamond</Text>
              <Text className="og-name">DeepSeek V4 Flash 0731</Text>
              <div className="og-price">
                <Text className="og-amount">$0.119</Text>
                <Text className="og-unit">per 1M, blended</Text>
                <Text className="og-score">91.0%</Text>
              </div>
            </div>
            <Plot />
          </div>

          <div className="og-copy">
            <Text className="og-title">AI model prices, side by side</Text>
            <Text className="og-line">Live per-token pricing beside independently-run benchmarks.</Text>
          </div>
        </>
      )}
    </Stage>
  )
}
