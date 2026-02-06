# Practice Tracker Architecture

See [practice.md](practice.md) for full documentation.

## Quick Overview

Minimal, non-demanding habit tracking with occasional AI wisdom (Obi-Wai):
- **Optional logging**: Practice name, duration, reflection (all optional)
- **Pattern-based wisdom**: ~14% of check-ins trigger Obi-Wai appearance
- **Practice discovery**: Conversational chat to explore practices
- **Garden visualization**: Generative SVG flowers based on practice data
- **No gamification**: No streaks, no pressure, observation-focused

## Core Concepts

- **Practice Logs**: Individual check-ins forming timeline/history
- **Practices**: Unique practice definitions with metadata
- **Practice Chats**: Saved conversations for practice discovery
- **Obi-Wai Wisdom**: Context-aware messages based on detected patterns
- **Rank Progression**: Flower metaphor (Seedling → Garden)

## Code Locations

- **Frontend**: `src/practice/*.njk`
- **Backend**: `netlify/functions/practice-*.js`
- **Services**: `netlify/functions/_services/db-practice-*.cjs`
- **Frontend Utils**: `src/assets/js/practice-*.js`

## Database Collections

- `practice-logs` - Individual check-in records
- `practices` - Practice definitions and metadata
- `practice-chats` - Saved practice discovery conversations

## Key Principles

- **Optional everything** - No required fields
- **No streaks** - No pressure to maintain daily habits
- **Wisdom, not metrics** - Focus on growth patterns, not numbers
- **Respectful AI** - Obi-Wai appears rarely and meaningfully
- **Beautiful simplicity** - Minimalist UI with flower metaphors
