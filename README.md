<h1 align="center">Awesome Claude Workflows</h1>

<p align="center">
  <a href="https://awesome.re"><img src="https://awesome.re/badge.svg" alt="Awesome" /></a>
  <a href="https://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
</p>

<p align="center">
A curated list of patterns, examples, and best practices for <b>Dynamic Workflows in Claude Code</b> — Claude's feature for orchestrating tens to hundreds of parallel subagents in a single session.
</p>

> This list is the workflow-shaped sibling of awesome-skills lists like
> [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills).
> Skills teach an agent *what to do* for one task; **workflows** orchestrate *many agents*
> to take on work too big for a single pass.

---

## Contents

- [What Are Dynamic Workflows?](#what-are-dynamic-workflows)
- [Getting Started](#getting-started)
- [Core Building Blocks](#core-building-blocks)
- [Orchestration Patterns](#orchestration-patterns)
- [Workflow Examples by Use Case](#workflow-examples-by-use-case)
  - [Code Review & Quality](#code-review--quality)
  - [Bug Hunts & Audits](#bug-hunts--audits)
  - [Migrations & Modernization](#migrations--modernization)
  - [Research & Synthesis](#research--synthesis)
  - [Design & Planning](#design--planning)
- [Case Studies](#case-studies)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)
- [Resources](#resources)
- [Contributing](#contributing)
- [License](#license)

## What Are Dynamic Workflows?

**Dynamic workflows** let Claude Code take on tasks that are too big for one pass by a single
agent. Instead of working through the problem inline, Claude *writes an orchestration script*
that breaks the task into subtasks and fans them out across many subagents running in parallel
— then verifies the results before folding them into a single, coordinated answer.

The defining characteristics:

- **Deterministic control flow.** The orchestration is a script (loops, conditionals, fan-out),
  so coordination is reproducible — not left to a model improvising turn by turn.
- **Massive parallelism.** Tens to hundreds of subagents run concurrently in one session.
- **Self-verification.** Agents attack the problem from independent angles; other agents try to
  *refute* what they found; the run iterates until answers converge.
- **Durable progress.** Work is checkpointed as the run proceeds, so an interrupted job resumes
  where it left off instead of restarting.
- **Out-of-band coordination.** Because orchestration happens outside the conversation, the plan
  stays on track no matter how large the task grows.

Announced in research preview on **May 28, 2026**
([blog post](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)). Available in
the Claude Code CLI, Desktop, and the VS Code extension for Max, Team, and Enterprise plans, plus
the Claude API, Amazon Bedrock, Vertex AI, and Microsoft Foundry.

> ⚠️ Dynamic workflows consume **substantially more tokens** than a typical Claude Code session.
> Start on a small, scoped task to calibrate usage before running anything large.

## Getting Started

1. **Enable it.** On Max / Team plans and the API, dynamic workflows are on by default.
   On Enterprise they're off by default — an admin enables them in
   [settings](https://code.claude.com/docs/en/settings).
2. **Turn on auto mode** for the best experience.
3. **Start a workflow** one of two ways:
   - Ask Claude directly: *"Create a workflow to …"*
   - Switch on the Claude Code-specific **`ultracode`** setting from the effort menu. It sets the
     effort level to `xhigh` and lets Claude decide automatically when a task warrants a workflow.
4. **Confirm the first run.** The first time a workflow triggers, Claude Code shows what's about
   to run and asks you to confirm before spawning agents.

📖 Official docs: <https://code.claude.com/docs/en/workflows>

## Core Building Blocks

A workflow script is plain JavaScript that begins with a `meta` block and then orchestrates
agents. The primitives:

| Primitive | What it does |
| --- | --- |
| `agent(prompt, opts?)` | Spawn one subagent. With a `schema`, it returns a validated structured object; without, its final text. |
| `pipeline(items, ...stages)` | Run each item through all stages independently — **no barrier** between stages. The default for multi-stage work. |
| `parallel(thunks)` | Run tasks concurrently and **wait for all** (a barrier). Use only when you genuinely need every result together. |
| `phase(title)` | Group subsequent agents under a named phase in the progress view. |
| `log(message)` | Emit a progress line to the user. |
| `workflow(name, args?)` | Run another saved workflow inline as a sub-step. |
| `args` / `budget` | The input passed to the workflow, and the shared token budget for dynamic scaling. |

```js
export const meta = {
  name: 'review-changes',
  description: 'Review changed files across dimensions, verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const DIMENSIONS = [
  { key: 'bugs', prompt: 'Find correctness bugs in the diff.' },
  { key: 'perf', prompt: 'Find performance regressions in the diff.' },
]

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA }),
  review => parallel(review.findings.map(f => () =>
    agent(`Adversarially verify: ${f.title}`, { phase: 'Verify', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v }))
  ))
)

return { confirmed: results.flat().filter(Boolean).filter(f => f.verdict?.isReal) }
```

## Orchestration Patterns

These are the reusable shapes that make workflows reliable. Compose them freely.

- **Pipeline-by-default** — Prefer `pipeline()` over a `parallel()` barrier between stages. Item A
  can be in stage 3 while item B is still in stage 1; wall-clock equals the slowest single chain,
  not the sum of slowest-per-stage.
- **Adversarial verify** — For each finding, spawn N independent skeptics prompted to *refute* it.
  Keep the finding only if a majority fail to refute. Kills plausible-but-wrong results.
- **Perspective-diverse verify** — When a finding can fail in more than one way, give each verifier
  a distinct lens (correctness, security, performance, reproducibility) instead of N identical ones.
- **Judge panel** — Generate N independent attempts from different angles (MVP-first, risk-first,
  user-first), score with parallel judges, synthesize from the winner while grafting the best ideas
  from runners-up.
- **Loop-until-dry** — For unknown-size discovery (bugs, edge cases), keep spawning finders until
  K consecutive rounds surface nothing new. Catches the long tail that fixed counts miss.
- **Multi-modal sweep** — Parallel agents each search a *different way* (by container, by content,
  by entity, by time). Each is blind to what the others find; useful when one angle can't see
  everything.
- **Completeness critic** — A final agent that asks "what's missing — a modality not run, a claim
  unverified, a source unread?" Its answers become the next round of work.
- **Hybrid scout-then-fan-out** — Scout inline first (list files, find the diff, scope the work),
  *then* fan out the workflow over the discovered work-list.

## Workflow Examples by Use Case

> 🚧 **Seeding in progress.** Add your battle-tested workflows here via a
> [pull request](#contributing). Each entry: a one-line description, a link to the script/gist/repo,
> and the pattern(s) it uses.

### Code Review & Quality

- _Review-changes (dimensions → verify)_ — see the [Core Building Blocks](#core-building-blocks)
  example above. Reviews a diff across independent dimensions and adversarially verifies each finding.

### Bug Hunts & Audits

- _Codebase-wide bug hunt_ — search a service/repo in parallel, run independent verification on
  every finding so only real issues surface. The same shape powers **security audits** (auth checks,
  input validation, unsafe patterns) and **profiler-guided optimization audits**.

### Migrations & Modernization

- _Language port / framework swap_ — map types or lifetimes first, transform each file in parallel
  (often with reviewers per file), then a fix-loop drives the build and test suite until clean.
  See the [Bun case study](#case-studies).

### Research & Synthesis

- _Fan-out research_ — multi-modal sweep across sources → deep-read the promising ones →
  adversarially verify claims → synthesize a cited report.

### Design & Planning

- _Plan stress-test (judge panel)_ — generate several independent plans from different angles, score
  them with parallel judges, and synthesize the strongest combined plan before you commit.

## Case Studies

- **Rewriting Bun (Zig → Rust).** Jarred Sumner used dynamic workflows to port Bun from Zig to Rust
  — **~750,000 lines of Rust, 99.8% of the existing test suite passing, 11 days from first commit to
  merge.** One workflow mapped the right Rust lifetime for every struct field in the Zig codebase;
  the next wrote every `.rs` file as a behavior-identical port of its `.zig` counterpart, hundreds of
  agents in parallel with two reviewers per file; a fix-loop then drove the build and tests until both
  ran clean; an overnight workflow addressed unnecessary data copies and opened a PR for each.
  *(Source: [Anthropic blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code).)*
- **Klarna — dead-code discovery.** Used dynamic workflows to identify dead code and surface cleanup
  opportunities that traditional static analysis missed, speeding up maintenance and refactoring.
- **CyberAgent — plan-to-implementation.** Reported that workflows "fill the gap between firing off a
  single subagent and building out a full agent team," enabling trusted longer runs without losing
  visibility.

## Best Practices

- **Scope before you scale.** Run a small task first to calibrate token usage — workflows can cost
  many times a normal session.
- **Default to pipelines; reserve barriers.** Only use a `parallel()` barrier when stage N genuinely
  needs cross-item context from *all* of stage N-1 (dedup/merge, early-exit on zero, cross-comparison).
- **Verify before you trust.** Add an adversarial or perspective-diverse verification stage; for
  high-stakes work require a majority vote before a finding survives.
- **Make truncation loud.** If a workflow caps coverage (top-N, sampling, no-retry), `log()` what was
  dropped — silent truncation reads as "covered everything" when it didn't.
- **Scale to the ask.** "Find any bugs" → a few finders, single-vote verify. "Thoroughly audit this"
  → a larger finder pool, 3–5 vote adversarial pass, and a synthesis stage.
- **Lean on resumability.** For long runs, trust the checkpointing — an interrupted job resumes rather
  than restarts.

## Anti-Patterns

- **Barrier-by-habit.** Inserting a `parallel()` barrier just to flatten/map/filter between stages
  wastes the wall-clock of fast items waiting on slow ones. Do the transform inside a pipeline stage.
- **Dedup against the wrong set.** In loop-until-dry, dedup against everything *seen*, not just what
  was *confirmed* — otherwise rejected findings reappear every round and the loop never converges.
- **Fixed-count discovery.** A `while (count < N)` loop quietly misses the tail; prefer loop-until-dry.
- **Workflow for trivial work.** A single edit or a one-fact lookup doesn't need orchestration —
  the token cost isn't justified.

## Resources

- [Introducing dynamic workflows in Claude Code](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) — official announcement (May 28, 2026)
- [Dynamic workflows documentation](https://code.claude.com/docs/en/workflows) — official docs
- [Claude Code settings](https://code.claude.com/docs/en/settings) — enabling/disabling workflows and `ultracode`
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) — the related Agent Teams feature
- [Dynamic Workflows in Claude Code — Hacker News discussion](https://news.ycombinator.com/item?id=48311705)
- [r/ClaudeCode: Multi-agent workflows](https://www.reddit.com/r/ClaudeCode/comments/1qlf38z/multiagent_workflows_aka_multiclauding/)

## Contributing

Contributions are welcome! This list grows on real, tested workflows. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. In short:

- One entry per workflow, in the right use-case section.
- Include a one-line description, a link, and the pattern(s) it uses.
- Prefer workflows you've actually run; note rough token cost if you can.

## License

[MIT](LICENSE) © 2026 lxcong and contributors. To the extent this list is a creative compilation,
the curated entries remain under their respective owners' licenses.
