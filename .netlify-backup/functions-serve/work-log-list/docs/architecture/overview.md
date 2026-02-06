# HabitualOS Architecture Overview

## System Purpose

HabitualOS is a personal AI orchestration platform that helps you accomplish goals through autonomous AI agents. Users create agents with clear goals, and those agents generate actionable deliverables through conversational interfaces.

**Core Philosophy**: Agents do ALL the work - users just provide context. This inverts traditional productivity tools where the user does the work and the tool just tracks it.

## Two Distinct Systems

### Agent System
Task and goal management through conversational AI agents:
- Create agents with goals, success criteria, timelines
- Agents generate deliverables (assets and actions)
- Autonomous task execution with scheduling
- Conversational refinement of deliverables

**Code locations**: `src/do/`, `netlify/functions/agent-*`, `netlify/functions/action-*`

### Practice System
Minimal habit tracking with occasional AI wisdom (Obi-Wai):
- Optional practice logging (name, duration, reflection)
- Pattern-based wisdom generation (~14% of check-ins)
- Practice discovery through conversation
- Garden visualization

**Code locations**: `src/practice/`, `netlify/functions/practice-*`

## User Journey (Agent System)

1. **Agent Creation** - Chat-based flow to define goal, success criteria, timeline
2. **Deliverable Generation** - Agent creates assets (immediate) or actions (scheduled)
3. **Refinement** - Draft deliverables refined via chat until well-defined
4. **Persistence** - Chat history saved when deliverable generated
5. **Scheduling** - Actions scheduled for autonomous execution
6. **Completion** - Agents execute work and produce artifacts

## Technology Stack

- **Frontend**: 11ty static site generator, Nunjucks templates
- **Backend**: Netlify serverless functions (Node.js)
- **Database**: Google Firestore
- **AI**: Claude API via Anthropic SDK
- **Deployment**: Netlify (git-based, read-only filesystem)

## Key Design Principles

- **Minimal user effort** - Agents do the heavy lifting
- **Conversational interfaces** - Natural language, not forms
- **Autonomous execution** - Tasks run on schedule without user intervention
- **Contract-focused docs** - Document behavior, not implementation
- **No over-engineering** - Simple solutions, avoid premature abstractions
