# Trading Agents

A multi-agent equity-analysis workflow for Claude Code, modeled faithfully on
[TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) — a framework that
mirrors the structure of a real trading firm. It reproduces that firm's roles and debate dynamics as
a single Claude Code **dynamic workflow**.

> ⚠️ **Research and education only. Not financial, investment, or trading advice.** Every agent is
> instructed to ground claims in retrieved data and to flag — never fabricate — anything it can't
> verify. Output quality depends on the data and models available at run time.

## Architecture

```
                         ┌──────────────── Analyst Team (parallel) ────────────────┐
   ticker, date ───────► │ Fundamentals   Sentiment   News   Technical             │
                         └──────────────────────────┬──────────────────────────────┘
                                                     ▼
                         Researcher Debate  ──  Bull  ⇄  Bear   (N rounds, sequential)
                                                     ▼
                         Research Manager  ──  balanced verdict (stance, lean, conviction)
                                                     ▼
                         Trader  ──  concrete proposal (action, size, entry/stop/target)
                                                     ▼
                         Risk Debate  ──  Aggressive ∥ Neutral ∥ Conservative  (parallel)
                                                     ▼
                         Risk Manager  ──  risk rating + required adjustments
                                                     ▼
                         Portfolio Manager  ──  final 5-tier rating (Buy/Overweight/Hold/Underweight/Sell)
```

This maps 1:1 onto TradingAgents' Analyst Team → Researcher Team → Trader → Risk Management →
Portfolio Manager pipeline, including the bull/bear research debate and the
aggressive/neutral/conservative risk debate.

## How it uses workflow primitives

- **`parallel()`** for the 4 analysts and the 3 risk reviewers — independent work, gathered at a barrier.
- **Sequential loops** for the debates — each turn must see the prior turns, so bull/bear (and the
  optional risk rounds) run in order with an accumulating transcript.
- **`agent({ schema })`** everywhere a downstream stage consumes the result, so each role returns a
  validated structured object instead of free text.
- **`phase()` / `log()`** to surface progress role-by-role in the `/workflows` view.
- **`args`** for `ticker`, `date`, `debateRounds`, `riskRounds` (no `new Date()` in workflow scripts,
  so the analysis date is passed in).

## Run it

From Claude Code, ask Claude to run the workflow, or invoke directly:

```js
Workflow({
  scriptPath: "workflows/trading-agents/trading-agents.workflow.js",
  args: { ticker: "NVDA", date: "2026-01-15", debateRounds: 2, riskRounds: 1 }
})
```

| Arg | Default | Meaning |
| --- | --- | --- |
| `ticker` | `"NVDA"` | Symbol to analyze |
| `date` | most recent trading day | Analysis date; agents ignore information after it |
| `debateRounds` | `2` | Bull⇄bear research debate rounds |
| `riskRounds` | `1` | Risk-reviewer debate rounds |

The agents discover and use whatever web-search / market-data / news / social tools are available in
your session (via `ToolSearch`). With no data tools connected, they will report `dataGaps` rather
than invent figures.

## Cost

This fans out ~12+ agents per run (4 analysts + 2×`debateRounds` debaters + research manager + trader
+ 3×`riskRounds` risk reviewers + risk manager + PM), several doing live data retrieval. Expect it to
cost **meaningfully more than a normal session** — start with one ticker and the default rounds before
scaling up.

## Differences from upstream

- No simulated exchange / order execution — the workflow ends at the Portfolio Manager's rated
  decision (it does not place trades).
- No persistent decision log or backtesting loop (upstream persists reflections across runs).
- Data access depends on the tools connected to your Claude Code session rather than upstream's
  bundled yfinance/Alpha Vantage/Reddit fetchers.
