#!/usr/bin/env bash
#
# install.sh — load workflows from this repo into your local Claude Code.
#
# Claude Code auto-discovers workflows dropped into:
#   ~/.claude/workflows/      (user scope — available in every project)   [default]
#   ./.claude/workflows/      (project scope — shared with everyone who clones the repo)
# Each installed file becomes a /<name> slash command.
#
# Usage:
#   ./install.sh [--project|--user] [name ...]
#
#   ./install.sh                      # from a clone: install ALL workflows (user scope)
#   ./install.sh trading-agents       # install one workflow
#   ./install.sh --project trading-agents
#
# No clone needed (remote install — names are required):
#   curl -fsSL https://raw.githubusercontent.com/lxcong/awesome-claude-workflows/main/install.sh \
#     | bash -s -- trading-agents
#
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/lxcong/awesome-claude-workflows/main"
DEST="$HOME/.claude/workflows"
names=()

for arg in "$@"; do
  case "$arg" in
    --project) DEST="$PWD/.claude/workflows" ;;
    --user)    DEST="$HOME/.claude/workflows" ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    -*)        echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)         names+=("$arg") ;;
  esac
done

# Are we running from a clone (is there a local workflows/ dir next to this script)?
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
LOCAL_ROOT=""
if [ -n "$SELF_DIR" ] && [ -d "$SELF_DIR/workflows" ]; then
  LOCAL_ROOT="$SELF_DIR"
fi

# No names given: install everything we can see in the local clone.
if [ "${#names[@]}" -eq 0 ]; then
  if [ -n "$LOCAL_ROOT" ]; then
    for d in "$LOCAL_ROOT"/workflows/*/; do
      [ -d "$d" ] && names+=("$(basename "$d")")
    done
  else
    echo "Remote install needs explicit workflow names, e.g.:" >&2
    echo "  curl -fsSL $REPO_RAW/install.sh | bash -s -- trading-agents" >&2
    exit 1
  fi
fi

mkdir -p "$DEST"
installed=()
for n in "${names[@]}"; do
  rel="workflows/$n/$n.workflow.js"
  dest_file="$DEST/$n.js"
  if [ -n "$LOCAL_ROOT" ] && [ -f "$LOCAL_ROOT/$rel" ]; then
    cp "$LOCAL_ROOT/$rel" "$dest_file"
  elif curl -fsSL "$REPO_RAW/$rel" -o "$dest_file"; then
    :
  else
    echo "✗ Could not find workflow '$n' (looked for $rel)" >&2
    rm -f "$dest_file"
    continue
  fi
  echo "✓ Installed /$n  →  $dest_file"
  installed+=("$n")
done

[ "${#installed[@]}" -eq 0 ] && { echo "Nothing installed." >&2; exit 1; }

cat <<EOF

Done. In Claude Code (v2.1.154+, Dynamic workflows enabled in /config):
  • run it:    /${installed[0]} ...
  • or browse: /workflows
First run asks you to approve the plan; pick "don't ask again" to skip it next time.
EOF
