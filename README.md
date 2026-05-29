<h1 align="center">Awesome Claude Workflows</h1>

<p align="center">
  <a href="https://awesome.re"><img src="https://awesome.re/badge.svg" alt="Awesome" /></a>
  <a href="https://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
</p>

<p align="center">
A community-curated list of real-world <b>Dynamic Workflows in Claude Code</b> —
shared by the people who actually run them in production.
</p>

New to the feature? See the [official docs](https://code.claude.com/docs/en/workflows) and the
[launch post](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code). This list isn't
a tutorial — it's a directory of battle-tested examples.

---

## Contents

- [Use a workflow](#use-a-workflow)
- [Workflows](#workflows)
  - [Code Review & Quality](#code-review--quality)
  - [Bug Hunts & Audits](#bug-hunts--audits)
  - [Migrations & Modernization](#migrations--modernization)
  - [Research & Synthesis](#research--synthesis)
  - [Design & Planning](#design--planning)
- [Resources](#resources)
- [Contributing](#contributing)
- [License](#license)

## Use a workflow

Claude Code auto-discovers any workflow file dropped into `~/.claude/workflows/` (user scope, every
project) or `./.claude/workflows/` (project scope). Each one becomes a `/<name>` slash command — no
plugin, manifest, or registration needed.

**Install with one command** (installs into `~/.claude/workflows/`):

```bash
# no clone needed — install a single workflow by name
curl -fsSL https://raw.githubusercontent.com/lxcong/awesome-claude-workflows/main/install.sh | bash -s -- trading-agents
```

Or from a clone:

```bash
git clone https://github.com/lxcong/awesome-claude-workflows.git
cd awesome-claude-workflows
./install.sh                  # install all workflows (user scope)
./install.sh trading-agents   # just one
./install.sh --project trading-agents   # into ./.claude/workflows/ instead
```

**Then, in Claude Code:**

```
/trading-agents NVDA as of 2026-05-28
```

or run `/workflows` to browse. (Manual alternative: copy any
`workflows/<name>/<name>.workflow.js` to `~/.claude/workflows/<name>.js` yourself.)

**Prerequisites:** Claude Code **v2.1.154+**, a paid plan, and Dynamic workflows enabled in
`/config`. The first run asks you to approve the plan — pick *"don't ask again"* to skip it next
time. Workflows can use **many tokens**; start scoped.

## Workflows

> 🌱 **This list is just getting started.** Have a workflow you've run on a real problem?
> [Add it](#contributing) — one line, a link, and the use case. That's the whole point of this repo.

### Code Review & Quality

- _Your workflow here →_ [Contribute](#contributing)

### Bug Hunts & Audits

- **Klarna — dead-code discovery** — Used dynamic workflows to identify dead code and surface cleanup
  opportunities that traditional static analysis missed, speeding up maintenance and refactoring.
  *(Reported in the [Anthropic launch post](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code).)*
- _Your codebase-wide bug hunt / security audit here →_ [Contribute](#contributing)

### Migrations & Modernization

- **Rewriting Bun (Zig → Rust)** — Jarred Sumner ported Bun from Zig to Rust with dynamic workflows:
  **~750,000 lines of Rust, 99.8% of the test suite passing, 11 days from first commit to merge.**
  One workflow mapped Rust lifetimes for every struct field; the next ported every `.rs` file as a
  behavior-identical translation with two reviewers each; a fix-loop drove build + tests until clean;
  an overnight workflow opened PRs for redundant-copy cleanups.
  *(Source: [Anthropic launch post](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code).)*
- _Your framework swap / API deprecation / language port here →_ [Contribute](#contributing)

### Research & Synthesis

- **[Trading Agents](workflows/trading-agents/)** — Multi-agent equity analysis: 4 analysts in
  parallel → bull/bear research debate → trader proposal → aggressive/neutral/conservative risk
  debate → portfolio manager's 5-tier rating. *Patterns: parallel fan-out, sequential debate, judge
  panel. Research only — not financial advice.*
- _Your multi-source research workflow here →_ [Contribute](#contributing)

### Design & Planning

- **CyberAgent — plan-to-implementation** — Reported that workflows "fill the gap between firing off a
  single subagent and building out a full agent team," enabling trusted longer runs without losing
  visibility. *(Reported in the [Anthropic launch post](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code).)*
- _Your plan stress-test / design workflow here →_ [Contribute](#contributing)

## Resources

- [Introducing dynamic workflows in Claude Code](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) — official launch post (May 28, 2026)
- [Dynamic workflows documentation](https://code.claude.com/docs/en/workflows) — official docs
- [Dynamic Workflows in Claude Code — Hacker News](https://news.ycombinator.com/item?id=48311705)
- [r/ClaudeCode: Multi-agent workflows](https://www.reddit.com/r/ClaudeCode/comments/1qlf38z/multiagent_workflows_aka_multiclauding/)

## Contributing

**This repo lives on your contributions.** If you've built a workflow that solved a real problem,
share it so others can learn from a working example.

See [CONTRIBUTING.md](CONTRIBUTING.md). In short — add one entry to the right use-case section:

```markdown
- [Name](link) — One-line description of the problem it solves. *By [@you](https://github.com/you)*
```

Prefer workflows you've actually run, and note the rough token cost / plan if you can.

## License

[MIT](LICENSE) © 2026 lxcong and contributors. Curated entries remain under their respective owners'
licenses.
