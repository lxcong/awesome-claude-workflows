# Trading Agents

A multi-agent equity-analysis workflow for Claude Code that mirrors the structure of a real trading
firm — reproducing its specialized roles and debate dynamics as a single Claude Code **dynamic
workflow**.

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

The pipeline runs Analyst Team → Researcher Team → Trader → Risk Management → Portfolio Manager,
including the bull/bear research debate and the aggressive/neutral/conservative risk debate.

## How it uses workflow primitives

- **`parallel()`** for the 4 analysts and the 3 risk reviewers — independent work, gathered at a barrier.
- **Sequential loops** for the debates — each turn must see the prior turns, so bull/bear (and the
  optional risk rounds) run in order with an accumulating transcript.
- **`agent({ schema })`** everywhere a downstream stage consumes the result, so each role returns a
  validated structured object instead of free text.
- **`phase()` / `log()`** to surface progress role-by-role in the `/workflows` view.
- **`args`** for `ticker`, `date`, `debateRounds`, `riskRounds` (no `new Date()` in workflow scripts,
  so the analysis date is passed in).

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/lxcong/awesome-claude-workflows/main/install.sh | bash -s -- trading-agents
```

This drops the script into `~/.claude/workflows/trading-agents.js`, where Claude Code auto-discovers
it as the `/trading-agents` command. (See the [repo install guide](../../README.md#use-a-workflow)
for project-scope and clone-based options.)

## Run it

Pick whichever fits — all three reach the same workflow.

**1. Slash command** (after installing). Type the command and put the ticker (and optional date) in
the trailing text; the script parses them out:

```
/trading-agents NVDA as of 2026-05-28
```

A bare `/trading-agents` runs with the defaults (NVDA, most recent trading day). The first run asks
you to approve the plan — pick *"don't ask again"* to skip it next time.

**2. Ask Claude in plain language.** Include the word *workflow* so Claude launches it and fills the
parameters for you:

```
Run the trading-agents workflow on 0700.HK as of 2026-05-28
```

**3. Call it directly** with fully structured args (most precise — best for scripting):

```js
Workflow({
  scriptPath: "workflows/trading-agents/trading-agents.workflow.js",
  args: { ticker: "NVDA", date: "2026-05-28", debateRounds: 2, riskRounds: 1 }
})
```

### What a run looks like

The run executes in the background; press `/workflows` to watch it phase by phase — here the four
analysts gathering data in parallel, each with its live token and tool-call counts:

![Trading Agents running in the Claude Code /workflows view: the Phases panel (Analysts → Research Debate → Research Verdict → Trader → Risk Debate → Portfolio Manager) beside the four parallel analyst agents](assets/run-progress.png)

### Parameters

| Arg | Default | Meaning |
| --- | --- | --- |
| `ticker` | `NVDA` | Symbol to analyze (US / HK `.HK` / etc.). From the slash command, the first all-caps token in your text. |
| `date` | most recent trading day | Analysis date; agents ignore information after it. From the slash command, a `YYYY-MM-DD` in your text. |
| `debateRounds` | `2` | Bull⇄bear research debate rounds (object/`Workflow()` args only) |
| `riskRounds` | `1` | Risk-reviewer debate rounds (object/`Workflow()` args only) |

> When run as the `/trading-agents` slash command, only `ticker` and `date` are read from the trailing
> text. To change `debateRounds` / `riskRounds`, use method 2 or 3.

The agents discover and use whatever web-search / market-data / news / social tools are available in
your session (via `ToolSearch`). With no data tools connected, they report `dataGaps` rather than
invent figures.

## Sample run

A real run is committed at
[`sample-run-nvda-2026-05-28.json`](sample-run-nvda-2026-05-28.json) — `NVDA`, analysis date
`2026-05-28`, `debateRounds: 2`, `riskRounds: 1`.

- **Scale:** 15 agents, ~629K subagent tokens, 120 tool calls, ~15 min wall-clock.
- **Final rating:** **Hold** (market-weight), 0% new capital.

| Stage | Outcome |
| --- | --- |
| Fundamentals | 🟢 bullish (0.74) — Q1 FY27 rev $81.6B (+85%), 74.9% GM, $96.7B FCF, fwd PEG ~1.0 |
| Sentiment | ⚪ neutral (0.58) — beat-but-faded; retail mood cooling; China-ban / Burry-short overhang |
| News | 🟢 bullish (0.62) — demand intact, but China DC revenue zeroed from guidance, rates a headwind |
| Technical | 🟢 bullish (0.58) — bullish MA stack, but stalled in a ~$198–226 box on below-avg volume |
| Research debate → manager | **mixed, conviction 0.62, lean hold** — "bull wins the present, bear wins the forward risk" |
| Trader | **HOLD** — no add at $212–214; >$226 close → add, <$198 close → trim |
| Risk debate (3 views) → manager | **medium, 2-to-1 against adding size** — overruled the add case on unconfirmed 50-DMA levels |

What this run demonstrates about workflows:

- **Grounded, not fabricated.** Every analyst cited real sources (NVIDIA IR, SEC, Barchart,
  StockTwits, …) and logged what it *couldn't* verify under `dataGaps` instead of inventing figures.
- **Adversarial verification caught real errors.** The risk manager flagged that three reviewers
  reported three conflicting moving-average levels; the portfolio manager then reconciled them against
  a single authoritative source and corrected the trader memo's figures before approving.
- **Guardrails held.** The agents repeatedly noted that this is public-equity analysis with no
  payment/wallet action implicated.

> The decision flipped to a disciplined **Hold** specifically *because* the verification stages
> refused to act on unconfirmed technical levels — a single-pass answer would likely have taken the
> bullish analyst signals at face value.

## Cost

This fans out ~12+ agents per run (4 analysts + 2×`debateRounds` debaters + research manager + trader
+ 3×`riskRounds` risk reviewers + risk manager + PM), several doing live data retrieval. Expect it to
cost **meaningfully more than a normal session** — start with one ticker and the default rounds before
scaling up.

## Scope & limitations

- No simulated exchange / order execution — the workflow ends at the Portfolio Manager's rated
  decision (it does not place trades).
- No persistent decision log or backtesting loop — each run is independent.
- Data access depends on the tools connected to your Claude Code session; with no data tools
  connected, agents report `dataGaps` rather than invent figures.
