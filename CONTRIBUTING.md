# Contributing to Awesome Claude Workflows

Thanks for helping grow this list! It collects **real, tested Dynamic Workflows in Claude Code** —
orchestration patterns, example scripts, and best practices.

## What belongs here

- **Workflow examples** — a script (or link to one) that orchestrates multiple subagents to solve a
  real task: code review, bug hunts, audits, migrations, research, planning, etc.
- **Patterns** — reusable orchestration shapes (fan-out, adversarial verify, judge panel,
  loop-until-dry, …) with a short rationale.
- **Resources** — high-quality docs, talks, posts, or discussions about dynamic workflows.

## What doesn't

- Generic prompt tips with no orchestration component.
- Untested or purely hypothetical workflows. Prefer things you've actually run.
- Single-agent skills — those belong in a skills list (e.g. awesome-claude-skills).

## How to add an entry

1. Fork the repo and create a branch.
2. Add your entry to the correct section of [`README.md`](README.md). Format:

   ```markdown
   - [Name](link) — One-line description. *Patterns: pipeline, adversarial verify.* *By [@you](https://github.com/you)*
   ```

3. Keep entries alphabetical within a section where practical.
4. If you can, note the **rough token cost** and the **plan** it requires — workflows can be
   expensive, and that context helps readers decide.
5. Open a pull request describing what the workflow does and that you've run it.

## Style

- One entry = one line. Put longer write-ups in a linked gist, repo, or `examples/` file.
- Use real, working links. No referral/affiliate links.
- Be honest about limitations and cost.

## Code of conduct

Be respectful and constructive. Maintainers may edit or decline entries to keep the list focused
and high quality.
