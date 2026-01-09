# HabitualOS System Overview

This document provides an up-to-date overview of the HabitualOS codebase.

## Architecture

HabitualOS uses a **context-aware agent system** that maintains understanding of the codebase through automated documentation updates.

### Context Sync System

The system automatically keeps documentation in sync with code changes:

- **Changelog Tracking**: Git post-commit hook appends commits to [`CHANGELOG_RECENT.md`](CHANGELOG_RECENT.md)
- **Documentation Updates**: [`scripts/context-sync.js`](scripts/context-sync.js) processes the changelog and updates this SYSTEM.md file
- **Agent Integration**: [`netlify/functions/agent-chat.js`](netlify/functions/agent-chat.js) includes SYSTEM.md content in API calls to provide agents with current codebase context

This enables design discussions with AI agents that have full understanding of the codebase structure and recent changes.

#### Workflow

1. Developer commits code → Git hook appends to CHANGELOG_RECENT.md
2. Context sync script reads changelog → Updates SYSTEM.md with integrated changes
3. Agent chat includes SYSTEM.md → Agents have current architecture context

## Key Files

- [`scripts/context-sync.js`](scripts/context-sync.js) - Automated documentation sync system
- [`netlify/functions/agent-chat.js`](netlify/functions/agent-chat.js) - Agent API integration with context awareness
- [`CHANGELOG_RECENT.md`](CHANGELOG_RECENT.md) - Rolling log of recent commits
- [`SYSTEM.md`](SYSTEM.md) - This file - living architecture documentation

## Development Patterns

- **Living Documentation**: Architecture docs stay current through automation
- **Context-Aware AI**: Agents receive full codebase context for better assistance
- **Git Hooks**: Automated changelog tracking on every commit