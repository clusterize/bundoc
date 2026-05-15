#!/usr/bin/env bash
set -euo pipefail

# Cuts a release of packages/bundoc:
#   1. bumps version (patch/minor/major) via `bun pm version`
#   2. commits the version bump and creates a git tag
#   3. pushes commit + tag, which triggers the release workflow on GitHub
#
# Note: `bun pm version` only edits package.json on disk — unlike
# `npm version` it does NOT create a git commit or tag, so we do that
# ourselves below.

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

# bun pm version only edits package.json — create the commit + tag ourselves
git add packages/bundoc/package.json
git commit -m "$TAG"
# Use annotated tag so `git push --follow-tags` actually pushes it
git tag -a "$TAG" -m "$TAG"

if ! gum confirm "push commit + tag to origin? (this triggers the release workflow)"; then
  gum style --foreground 3 "skipping push — local commit + tag are still in place"
  gum style "to undo: git tag -d $TAG && git reset HEAD~1"
  exit 0
fi

# Push the commit, then explicitly push the tag by full ref to avoid
# ambiguity if a branch with the same name somehow exists.
git push
git push origin "refs/tags/$TAG"
gum style --foreground 2 --bold "pushed $TAG — release workflow should be running"
