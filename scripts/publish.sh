#!/usr/bin/env bash
set -euo pipefail

# Cuts a release of packages/bundoc:
#   1. bumps version (patch/minor/major) via `bun pm version`
#   2. lets `bun pm version` create the commit + tag
#   3. pushes commit + tag, which triggers the release workflow on GitHub

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_DIR="$REPO_ROOT/packages/bundoc"

cd "$REPO_ROOT"

if ! command -v gum >/dev/null 2>&1; then
  echo "error: gum is required. install: brew install gum (or via mise)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  gum style --foreground 1 "working tree is dirty — commit or stash first"
  git status --short
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  gum confirm "not on main (currently '$BRANCH'). continue anyway?" || exit 1
fi

CURRENT_VERSION="$(cd "$PKG_DIR" && node -p "require('./package.json').version")"
gum style --bold "current version: $CURRENT_VERSION"

BUMP="$(gum choose --header "bump type?" patch minor major)"

cd "$PKG_DIR"
NEW_VERSION="$(bun pm version "$BUMP" | tail -n 1 | tr -d 'v')"
TAG="v$NEW_VERSION"

cd "$REPO_ROOT"
gum style --bold "bumped to $NEW_VERSION (tag $TAG)"

if ! gum confirm "push commit + tag to origin? (this triggers the release workflow)"; then
  gum style --foreground 3 "skipping push — local commit + tag are still in place"
  gum style "to undo: git tag -d $TAG && git reset --hard HEAD~1"
  exit 0
fi

git push --follow-tags
gum style --foreground 2 --bold "pushed $TAG — release workflow should be running"
