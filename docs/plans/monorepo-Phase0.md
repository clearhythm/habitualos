# Phase 0: Preparation & Safety Setup

## Objective
Create a safe working environment before making any structural changes.

## Context
We're converting HabitualOS into a monorepo to support multiple apps. This phase ensures we can safely revert if anything goes wrong.

## Prerequisites
- Git repository is clean (no uncommitted changes)
- You have push access to the repo

## Steps

### Step 0.1: Commit any pending work
```bash
git status
# If there are changes, commit them first
git add -A && git commit -m "WIP: Save state before monorepo migration"
```

### Step 0.2: Create migration branch
```bash
git checkout -b monorepo-migration
```

### Step 0.3: Create a safety tag
```bash
git tag pre-monorepo-migration
```

## Verification
- [ ] `git branch` shows you're on `monorepo-migration`
- [ ] `git tag` shows `pre-monorepo-migration` exists
- [ ] Running `git status` shows clean working directory

## Safety Guidelines (for all phases)
1. **Keep main app working** - Test after each major change
2. **Incremental migration** - Get shared package working before building second app
3. **Fallback option** - If tooling fights you, `git checkout main` to revert
4. **Trust the signal** - If setup takes more than a few hours, reconsider approach

## Rollback
To abort the entire migration at any point:
```bash
git checkout main
git branch -D monorepo-migration
```

## Next Phase
When verification passes, proceed to [Phase 1: Create Workspace Foundation](./monorepo-Phase1.md)
