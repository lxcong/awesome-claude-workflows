/**
 * Trading Agents — a multi-agent financial analysis workflow for Claude Code.
 *
 * Faithfully mirrors the architecture of TauricResearch/TradingAgents
 * (https://github.com/TauricResearch/TradingAgents), reimagined as a single
 * Claude Code dynamic workflow:
 *
 *   Analyst Team (4 parallel)  →  Researcher Debate (bull vs bear, N rounds)
 *   →  Research Manager verdict →  Trader proposal
 *   →  Risk Debate (aggressive / neutral / conservative) → Risk Manager
 *   →  Portfolio Manager final call (5-tier rating)
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
  description: 'Multi-agent equity analysis (analysts → bull/bear debate → trader → risk → PM) modeled on TauricResearch/TradingAgents',
  whenToUse: 'Deep, multi-perspective analysis of a single ticker that ends in a rated, risk-checked decision. Research only — not financial advice.',
  phases: [
    { title: 'Analysts', detail: '4 analysts gather data in parallel: fundamentals, sentiment, news, technical' },
    { title: 'Research Debate', detail: 'Bull vs bear researchers debate over N rounds' },
    { title: 'Research Verdict', detail: 'Research manager judges the debate' },
    { title: 'Trader', detail: 'Trader turns the verdict into a concrete proposal' },
    { title: 'Risk Debate', detail: 'Aggressive / neutral / conservative risk reviewers stress-test the trade' },
    { title: 'Portfolio Manager', detail: 'Final approve/reject with a 5-tier rating' },
  ],
}

// ---- Inputs -----------------------------------------------------------------
// `args` is supplied at run time. No Date.now()/new Date() in workflow scripts,
// so the analysis date must be passed in explicitly.
const ticker = (args && args.ticker) || 'NVDA'
const date = (args && args.date) || 'the most recent trading day'
const debateRounds = (args && args.debateRounds) || 2
const riskRounds = (args && args.riskRounds) || 1

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

return {
  ticker,
  date,
  decision,
  riskManager: riskManagerCall,
  trade,
  researchVerdict,
  analysts: analystReports,
  disclaimer: 'Research/education only. Not financial, investment, or trading advice.',
}
