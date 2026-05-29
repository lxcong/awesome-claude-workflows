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

## Bundling a runnable workflow (so others can one-command install it)

The repo ships an [`install.sh`](install.sh) that copies a workflow into a user's
`~/.claude/workflows/`, where Claude Code auto-discovers it as a `/<name>` command. For that to work,
follow this layout and format:

1. **Directory:** `workflows/<name>/` where `<name>` is kebab-case and matches your `meta.name`.
2. **Script file:** `workflows/<name>/<name>.workflow.js`. The installer copies it to
   `~/.claude/workflows/<name>.js`.
3. **Format:** a dynamic-workflow script that starts with a pure-literal `meta` block:

   ```js
   export const meta = {
     name: 'your-name',          // becomes the /your-name command — match the directory
     description: '...',          // one line, shown in the approval prompt
     phases: [{ title: '...' }],  // one entry per phase() call
   }
   // ...orchestration using agent()/parallel()/pipeline()/phase()/log()
   ```

4. **Inputs:** read runtime inputs from the `args` global and provide sane defaults — workflow
   scripts can't call `new Date()`/`Math.random()`, so pass dates/seeds via `args`.
5. **README:** add `workflows/<name>/README.md` with architecture, an install one-liner, args, and a
   rough token cost. A committed sample run (`sample-run-*.json`) is a big plus.
6. **Verify it runs** before submitting, and `node --check` the script for syntax.

## How to add a list entry

1. Fork the repo and create a branch.
2. Add your entry to the correct section of [`README.md`](README.md). Format:

   ```markdown
   - [Name](workflows/your-name/) — One-line description. *Patterns: pipeline, adversarial verify.* *By [@you](https://github.com/you)*
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
