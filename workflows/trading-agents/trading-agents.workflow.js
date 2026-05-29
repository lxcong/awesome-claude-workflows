/**
 * Trading Agents — a multi-agent financial analysis workflow for Claude Code.
 *
 * Mirrors the structure of a real trading firm as a single Claude Code
 * dynamic workflow:
 *
 *   Analyst Team (4 parallel)  →  Researcher Debate (bull vs bear, N rounds)
 *   →  Research Manager verdict →  Trader proposal
 *   →  Risk Debate (aggressive / neutral / conservative) → Risk Manager
 *   →  Portfolio Manager final call (5-tier rating)
 *   →  Export: a Markdown report + a deterministic, self-contained HTML page
 *
 * Run it:
 *   Workflow({ scriptPath: ".../trading-agents.workflow.js",
 *              args: { ticker: "NVDA", date: "2026-01-15", debateRounds: 2 } })
 *
 * ⚠️  Research/education only. NOT financial, investment, or trading advice.
 *     Agents are instructed to ground every claim in retrieved data and to
 *     flag — never fabricate — anything they cannot verify.
 */

export const meta = {
  name: 'trading-agents',
  description: 'Multi-agent equity analysis (analysts → bull/bear debate → trader → risk → PM)',
  whenToUse: 'Deep, multi-perspective analysis of a single ticker that ends in a rated, risk-checked decision. Research only — not financial advice.',
  phases: [
    { title: 'Analysts', detail: '4 analysts gather data in parallel: fundamentals, sentiment, news, technical' },
    { title: 'Research Debate', detail: 'Bull vs bear researchers debate over N rounds' },
    { title: 'Research Verdict', detail: 'Research manager judges the debate' },
    { title: 'Trader', detail: 'Trader turns the verdict into a concrete proposal' },
    { title: 'Risk Debate', detail: 'Aggressive / neutral / conservative risk reviewers stress-test the trade' },
    { title: 'Portfolio Manager', detail: 'Final approve/reject with a 5-tier rating' },
    { title: 'Export', detail: 'Write a Markdown report and a deterministic, self-contained HTML page' },
  ],
}

// ---- Inputs -----------------------------------------------------------------
// `args` is supplied at run time and may arrive two ways:
//   • a structured object — Workflow({ args: { ticker, date, debateRounds, riskRounds } })
//   • a free-text string  — the trailing text of the `/trading-agents NVDA as of 2026-05-28` command
// Handle both. (No Date.now()/new Date() in workflow scripts, so the date is parsed/passed in.)
const _obj = (args && typeof args === 'object') ? args : {}
const _text = (typeof args === 'string') ? args : ''
const _ticker = _text.match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/)   // e.g. NVDA, 0700.HK, BRK.B
const _date = _text.match(/\b\d{4}-\d{2}-\d{2}\b/)               // e.g. 2026-05-28

const ticker = _obj.ticker || (_ticker && _ticker[0]) || 'NVDA'
const date = _obj.date || (_date && _date[0]) || 'the most recent trading day'
const debateRounds = _obj.debateRounds || 2
const riskRounds = _obj.riskRounds || 1
const outDir = _obj.outDir || 'trading-agents-reports'

const DATA_RULES = `
Ground every claim in data you actually retrieve using the tools available to you
(web search, market-data, news, and social tools — discover them via ToolSearch).
Treat the analysis date as ${date} and do not use information from after it.
If you cannot retrieve a figure, say so explicitly under dataGaps — never fabricate
numbers, prices, or quotes.`.trim()

// ---- Structured-output schemas ---------------------------------------------
const ANALYST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analyst: { type: 'string' },
    summary: { type: 'string', description: 'Tight 3-6 sentence read' },
    signal: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
    confidence: { type: 'number', description: '0-1' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    dataGaps: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['analyst', 'summary', 'signal', 'confidence', 'keyPoints'],
}

const RESEARCH_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stance: { type: 'string', enum: ['bullish', 'bearish', 'mixed'] },
    conviction: { type: 'number', description: '0-1' },
    lean: { type: 'string', enum: ['buy', 'hold', 'sell'] },
    strongestBullArgument: { type: 'string' },
    strongestBearArgument: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['stance', 'conviction', 'lean', 'rationale'],
}

const TRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
    sizePct: { type: 'number', description: 'Suggested position size as % of book' },
    entry: { type: 'string' },
    stopLoss: { type: 'string' },
    takeProfit: { type: 'string' },
    timeframe: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['action', 'rationale'],
}

const RISK_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    perspective: { type: 'string' },
    assessment: { type: 'string' },
    mainConcern: { type: 'string' },
    suggestedAdjustment: { type: 'string' },
    verdict: { type: 'string', enum: ['approve', 'approve_with_changes', 'reject'] },
  },
  required: ['perspective', 'assessment', 'verdict'],
}

const RISK_MANAGER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    riskRating: { type: 'string', enum: ['low', 'medium', 'high'] },
    approvedForPM: { type: 'boolean' },
    requiredAdjustments: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
  required: ['riskRating', 'approvedForPM', 'rationale'],
}

const PM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell'] },
    finalAction: { type: 'string' },
    positionSizePct: { type: 'number' },
    rationale: { type: 'string' },
    keyRisks: { type: 'array', items: { type: 'string' } },
    conditions: { type: 'array', items: { type: 'string' } },
  },
  required: ['decision', 'finalAction', 'rationale'],
}

// ---- Phase 1: Analyst Team (parallel) --------------------------------------
phase('Analysts')
log(`Analyzing ${ticker} as of ${date} — dispatching 4 analysts`)

const ANALYSTS = [
  {
    key: 'fundamentals',
    brief: `You are the FUNDAMENTALS ANALYST. Evaluate ${ticker}'s financials and
      performance metrics — revenue/earnings trend, margins, growth, balance sheet,
      valuation multiples vs peers. Identify intrinsic value and red flags.`,
  },
  {
    key: 'sentiment',
    brief: `You are the SENTIMENT ANALYST. Aggregate recent news headlines, StockTwits,
      and Reddit chatter on ${ticker} into a single short-term market-mood read.`,
  },
  {
    key: 'news',
    brief: `You are the NEWS ANALYST. Monitor global news and macro indicators relevant
      to ${ticker}; interpret how recent events and the macro backdrop affect it.`,
  },
  {
    key: 'technical',
    brief: `You are the TECHNICAL ANALYST. Use technical indicators (trend, MACD, RSI,
      moving averages, volume, support/resistance) to read ${ticker}'s price action and
      near-term setup.`,
  },
]

const analystReports = (await parallel(
  ANALYSTS.map(a => () =>
    agent(
      `${a.brief}\n\n${DATA_RULES}\n\nReturn a structured analyst report for ${ticker}.`,
      { label: `analyst:${a.key}`, phase: 'Analysts', schema: ANALYST_SCHEMA },
    ),
  ),
)).filter(Boolean)

const analystDigest = analystReports
  .map(r => `### ${r.analyst} — signal: ${r.signal} (conf ${r.confidence})\n${r.summary}\nKey: ${(r.keyPoints || []).join('; ')}\nRisks: ${(r.risks || []).join('; ')}`)
  .join('\n\n')

// ---- Phase 2: Researcher Debate (bull vs bear, sequential rounds) ----------
phase('Research Debate')
let transcript = ''
for (let round = 1; round <= debateRounds; round++) {
  const bull = await agent(
    `You are the BULLISH RESEARCHER debating ${ticker} (round ${round}/${debateRounds}).
     Build the strongest evidence-based case to BUY/hold long. Rebut the bear's latest points.

     Analyst reports:\n${analystDigest}\n\nDebate so far:\n${transcript || '(none yet)'}\n\n${DATA_RULES}`,
    { label: `bull:r${round}`, phase: 'Research Debate' },
  )
  transcript += `\n\n[Round ${round}] BULL: ${bull}`

  const bear = await agent(
    `You are the BEARISH RESEARCHER debating ${ticker} (round ${round}/${debateRounds}).
     Build the strongest evidence-based case to AVOID/short. Directly rebut the bull's points above.

     Analyst reports:\n${analystDigest}\n\nDebate so far:\n${transcript}\n\n${DATA_RULES}`,
    { label: `bear:r${round}`, phase: 'Research Debate' },
  )
  transcript += `\n\n[Round ${round}] BEAR: ${bear}`
  log(`Research debate round ${round}/${debateRounds} complete`)
}

// ---- Phase 3: Research Manager verdict -------------------------------------
phase('Research Verdict')
const researchVerdict = await agent(
  `You are the RESEARCH MANAGER. Judge the bull/bear debate on ${ticker} objectively and
   declare a balanced verdict. Weigh which side argued from stronger evidence.

   Analyst reports:\n${analystDigest}\n\nFull debate:\n${transcript}`,
  { label: 'research-manager', phase: 'Research Verdict', schema: RESEARCH_VERDICT_SCHEMA },
)

// ---- Phase 4: Trader proposal ----------------------------------------------
phase('Trader')
const trade = await agent(
  `You are the TRADER. Compose the analyst reports and the research manager's verdict into
   a concrete, actionable proposal for ${ticker} as of ${date}. Decide timing and magnitude.

   Research verdict: ${JSON.stringify(researchVerdict)}\n\nAnalyst reports:\n${analystDigest}`,
  { label: 'trader', phase: 'Trader', schema: TRADE_SCHEMA },
)

// ---- Phase 5: Risk Debate (3 perspectives, optional rounds) ----------------
phase('Risk Debate')
const RISK_VIEWS = [
  { key: 'aggressive', brief: 'You favor higher risk/reward; defend the upside and argue for keeping or increasing exposure where justified.' },
  { key: 'neutral', brief: 'You are balanced; weigh reward against downside dispassionately.' },
  { key: 'conservative', brief: 'You prioritize capital preservation; surface tail risks and argue for caution or smaller size.' },
]

let riskReviews = []
for (let round = 1; round <= riskRounds; round++) {
  const priorRisk = riskReviews.length
    ? `\n\nPrior-round risk views:\n${riskReviews.map(r => `${r.perspective}: ${r.assessment}`).join('\n')}`
    : ''
  const round_ = (await parallel(
    RISK_VIEWS.map(v => () =>
      agent(
        `You are the ${v.key.toUpperCase()} RISK REVIEWER for the proposed ${ticker} trade.
         ${v.brief}\n\nProposed trade: ${JSON.stringify(trade)}\nResearch verdict: ${JSON.stringify(researchVerdict)}${priorRisk}\n\n${DATA_RULES}`,
        { label: `risk:${v.key}:r${round}`, phase: 'Risk Debate', schema: RISK_REVIEW_SCHEMA },
      ),
    ),
  )).filter(Boolean)
  riskReviews = round_
  log(`Risk debate round ${round}/${riskRounds} complete`)
}

const riskManagerCall = await agent(
  `You are the RISK MANAGER. Synthesize the risk reviewers into a single risk assessment for
   the ${ticker} trade. Decide whether it is fit to forward to the Portfolio Manager and what
   adjustments are required.

   Proposed trade: ${JSON.stringify(trade)}\nRisk reviews: ${JSON.stringify(riskReviews)}`,
  { label: 'risk-manager', phase: 'Risk Debate', schema: RISK_MANAGER_SCHEMA },
)

// ---- Phase 6: Portfolio Manager final decision -----------------------------
phase('Portfolio Manager')
const decision = await agent(
  `You are the PORTFOLIO MANAGER making the final call on ${ticker} as of ${date}.
   Approve or reject the trade and issue a 5-tier rating
   (Buy / Overweight / Hold / Underweight / Sell). Be decisive but honor the risk
   manager's required adjustments.

   Research verdict: ${JSON.stringify(researchVerdict)}
   Proposed trade: ${JSON.stringify(trade)}
   Risk manager: ${JSON.stringify(riskManagerCall)}

   Reminder: this is research/education only, not financial advice. State that in your rationale.`,
  { label: 'portfolio-manager', phase: 'Portfolio Manager', schema: PM_SCHEMA },
)

log(`Final rating for ${ticker}: ${decision.decision}`)

// ---- Phase 7: Export artifacts ---------------------------------------------
// Both artifacts are built by fixed templates (pure functions of the run data)
// — no LLM redesign, no timestamps, no randomness — so the same data always
// renders the same files. The workflow script can't touch the filesystem, so a
// single agent writes the pre-rendered bytes verbatim.
phase('Export')

const report = {
  ticker, date, decision,
  riskManager: riskManagerCall,
  trade, researchVerdict,
  analysts: analystReports,
}
const slug = `${ticker}-${date}`.replace(/[^A-Za-z0-9._-]+/g, '_')
const mdPath = `${outDir}/${slug}.md`
const htmlPath = `${outDir}/${slug}.html`
const markdown = buildMarkdown(report)
const html = buildHtml(report)

await agent(
  `Write two pre-rendered report files to disk EXACTLY as given — byte for byte. Do NOT edit,
   reformat, summarize, pretty-print, or add anything of your own. Create the directory "${outDir}"
   if it does not exist, then use the Write tool to create each file with the exact content between
   its markers (do not include the marker lines). Reply with only the two file paths.

=== FILE A === path: ${mdPath}
<<<<<<MARKDOWN_BEGIN
${markdown}
MARKDOWN_END>>>>>>

=== FILE B === path: ${htmlPath}
<<<<<<HTML_BEGIN
${html}
HTML_END>>>>>>`,
  { label: 'export', phase: 'Export' },
)

log(`Exported report → ${mdPath} and ${htmlPath}`)

return {
  ticker,
  date,
  decision,
  riskManager: riskManagerCall,
  trade,
  researchVerdict,
  analysts: analystReports,
  artifacts: { markdown: mdPath, html: htmlPath },
  disclaimer: 'Research/education only. Not financial, investment, or trading advice.',
}

// ---- Deterministic artifact builders (pure functions of the run data) ------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function chipClass(v) {
  const s = String(v || '').toLowerCase()
  if (/(bull|buy|overweight|approve|low)/.test(s)) return 'pos'
  if (/(bear|sell|underweight|reject|high)/.test(s)) return 'neg'
  return 'neu'
}
function mdList(items) {
  return items && items.length ? items.map(x => `- ${x}`).join('\n') : '_None._'
}
function htmlList(items) {
  return items && items.length
    ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p class="muted">None.</p>'
}
function paras(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  return t.split(/\n\n+/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

function buildMarkdown(r) {
  const d = r.decision, t = r.trade, rm = r.riskManager, rv = r.researchVerdict
  const analysts = r.analysts.map(a => [
    `### ${a.analyst}`,
    `**Signal:** ${a.signal} · confidence ${a.confidence}`,
    a.summary || '',
    `**Key points**\n${mdList(a.keyPoints)}`,
    `**Risks**\n${mdList(a.risks)}`,
    `**Data gaps**\n${mdList(a.dataGaps)}`,
    `**Sources**\n${mdList(a.sources)}`,
  ].join('\n\n')).join('\n\n')

  return [
    `# ${r.ticker} — Equity Analysis`,
    `**Analysis date:** ${r.date}  \n**Final rating:** ${d.decision}` +
      (typeof d.positionSizePct === 'number' ? ` · position ${d.positionSizePct}%` : ''),
    `> ⚠️ Research/education only. Not financial, investment, or trading advice.`,
    `## Decision`,
    d.finalAction || '',
    d.rationale || '',
    `### Conditions\n${mdList(d.conditions)}`,
    `### Key risks\n${mdList(d.keyRisks)}`,
    `## Trade proposal`,
    [
      `- **Action:** ${t.action}` + (typeof t.sizePct === 'number' ? ` · size ${t.sizePct}%` : ''),
      `- **Entry:** ${t.entry || '—'}`,
      `- **Stop loss:** ${t.stopLoss || '—'}`,
      `- **Take profit:** ${t.takeProfit || '—'}`,
      `- **Timeframe:** ${t.timeframe || '—'}`,
    ].join('\n'),
    t.rationale || '',
    `## Risk manager`,
    `- **Risk rating:** ${rm.riskRating}\n- **Approved for PM:** ${rm.approvedForPM ? 'yes' : 'no'}`,
    `**Required adjustments**\n${mdList(rm.requiredAdjustments)}`,
    rm.rationale || '',
    `## Research verdict`,
    `- **Stance:** ${rv.stance} · **lean:** ${rv.lean} · **conviction:** ${rv.conviction}`,
    `**Strongest bull argument**\n\n${rv.strongestBullArgument || '—'}`,
    `**Strongest bear argument**\n\n${rv.strongestBearArgument || '—'}`,
    rv.rationale || '',
    `## Analyst reports`,
    analysts,
    `---\n_Generated by the trading-agents workflow. Research only — not financial advice._`,
  ].filter(Boolean).join('\n\n') + '\n'
}

function buildHtml(r) {
  const d = r.decision, t = r.trade, rm = r.riskManager, rv = r.researchVerdict
  const cards = r.analysts.map(a => `
      <article class="card">
        <div class="card-h"><h3>${esc(a.analyst)}</h3><span class="chip ${chipClass(a.signal)}">${esc(a.signal)} · ${esc(a.confidence)}</span></div>
        ${paras(a.summary)}
        <h4>Key points</h4>${htmlList(a.keyPoints)}
        ${a.risks && a.risks.length ? `<h4>Risks</h4>${htmlList(a.risks)}` : ''}
        ${a.dataGaps && a.dataGaps.length ? `<h4>Data gaps</h4>${htmlList(a.dataGaps)}` : ''}
        ${a.sources && a.sources.length ? `<details><summary>Sources (${a.sources.length})</summary>${htmlList(a.sources)}</details>` : ''}
      </article>`).join('')

  const css = `
    *{box-sizing:border-box}
    body{margin:0;background:#fbfaf7;color:#1a1a1a;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
    main{max-width:760px;margin:0 auto;padding:64px 24px 96px}
    .masthead{border-bottom:2px solid #1a1a1a;padding-bottom:24px;margin-bottom:8px}
    .eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#6b6b6b;margin:0 0 6px}
    h1{font:700 44px/1.1 Georgia,"Times New Roman",serif;margin:0 0 16px}
    h2{font:700 22px/1.3 Georgia,serif;margin:48px 0 12px;padding-bottom:6px;border-bottom:1px solid #e6e3dd}
    h3{font-size:16px;margin:24px 0 8px}
    h4{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:#6b6b6b;margin:18px 0 6px}
    p{margin:0 0 14px}.muted{color:#6b6b6b}
    .disclaimer{color:#6b6b6b;font-size:13px;margin:14px 0 0}
    .verdict{display:flex;align-items:center;gap:12px;margin-top:8px}
    .chip{display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600}
    .rating{font-size:18px;padding:6px 18px}
    .chip.pos{background:#e8f5ee;color:#0a7f3f}.chip.neg{background:#fbeceb;color:#b3261e}.chip.neu{background:#fdf3da;color:#8a6d00}
    ul{margin:0 0 14px;padding-left:20px}li{margin:4px 0}
    table.kv{width:100%;border-collapse:collapse;margin:0 0 16px}
    table.kv th{text-align:left;width:120px;color:#6b6b6b;font-weight:600;vertical-align:top;padding:6px 12px 6px 0}
    table.kv td{padding:6px 0}
    .cards{display:grid;gap:20px}
    .card{border:1px solid #e6e3dd;border-radius:10px;padding:20px;background:#fff}
    .card-h{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}.card-h h3{margin:0}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:600px){.two-col{grid-template-columns:1fr}}
    details{margin-top:10px}summary{cursor:pointer;color:#6b6b6b;font-size:13px}
    footer{margin-top:64px;padding-top:16px;border-top:1px solid #e6e3dd;color:#6b6b6b;font-size:12px}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.ticker)} — Equity Analysis (${esc(r.date)})</title>
<style>${css}</style>
</head>
<body>
<main>
  <header class="masthead">
    <p class="eyebrow">Equity analysis · ${esc(r.date)}</p>
    <h1>${esc(r.ticker)}</h1>
    <div class="verdict">
      <span class="rating chip ${chipClass(d.decision)}">${esc(d.decision)}</span>
      ${typeof d.positionSizePct === 'number' ? `<span class="muted">position ${esc(d.positionSizePct)}%</span>` : ''}
    </div>
  </header>
  <p class="disclaimer">⚠️ Research/education only. Not financial, investment, or trading advice.</p>

  <section>
    <h2>Decision</h2>
    ${paras(d.finalAction)}
    ${paras(d.rationale)}
    <h3>Conditions</h3>${htmlList(d.conditions)}
    <h3>Key risks</h3>${htmlList(d.keyRisks)}
  </section>

  <section>
    <h2>Trade proposal</h2>
    <table class="kv">
      <tr><th>Action</th><td>${esc(t.action)}${typeof t.sizePct === 'number' ? ` · size ${esc(t.sizePct)}%` : ''}</td></tr>
      <tr><th>Entry</th><td>${esc(t.entry || '—')}</td></tr>
      <tr><th>Stop loss</th><td>${esc(t.stopLoss || '—')}</td></tr>
      <tr><th>Take profit</th><td>${esc(t.takeProfit || '—')}</td></tr>
      <tr><th>Timeframe</th><td>${esc(t.timeframe || '—')}</td></tr>
    </table>
    ${paras(t.rationale)}
  </section>

  <section>
    <h2>Risk manager</h2>
    <p><span class="chip ${chipClass(rm.riskRating)}">${esc(rm.riskRating)} risk</span> · approved for PM: ${rm.approvedForPM ? 'yes' : 'no'}</p>
    <h3>Required adjustments</h3>${htmlList(rm.requiredAdjustments)}
    ${paras(rm.rationale)}
  </section>

  <section>
    <h2>Research verdict</h2>
    <p><span class="chip ${chipClass(rv.stance)}">${esc(rv.stance)}</span> · lean ${esc(rv.lean)} · conviction ${esc(rv.conviction)}</p>
    <div class="two-col">
      <div><h4>Strongest bull</h4>${paras(rv.strongestBullArgument)}</div>
      <div><h4>Strongest bear</h4>${paras(rv.strongestBearArgument)}</div>
    </div>
    ${paras(rv.rationale)}
  </section>

  <section>
    <h2>Analyst reports</h2>
    <div class="cards">${cards}
    </div>
  </section>

  <footer>Generated by the trading-agents workflow · ${esc(r.ticker)} · ${esc(r.date)}</footer>
</main>
</body>
</html>
`
}
