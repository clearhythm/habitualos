# Discovery Pipeline — Phase 1: Enhanced Company Schema

## Context

HabitualOS is a personal agentic system built on Netlify serverless functions, 11ty static site generator, and Google Firestore. We are building a company discovery pipeline where agents find companies matching user interests, store them as drafts, and the user reviews them via chat.

This phase updates the company markdown template and existing files to a richer frontmatter schema that supports discovery, agent recommendations, user feedback, and future embedding/semantic search.

## Current State

- Template at: `data/careerlaunch-agent-mk3jq2dqjbfy/_templates/company.md`
- One existing company file: `data/careerlaunch-agent-mk3jq2dqjbfy/companies/Google.md`
- Current template has minimal frontmatter: `type`, `name`, `domain`, `status`, `tags`
- Current template has body sections (Why, What I like, etc.) that are no longer needed

## Requirements

### Updated Template Frontmatter

Replace the entire template file content with frontmatter-only format:

```yaml
---
type: company
name: "{{title}}"
domain:
stage:                       # pre-seed | seed | series-a | series-b | series-c+ | public | unknown
employee_band:               # 1-10 | 11-50 | 51-200 | 201-500 | 500-1000 | 1000+
agent_recommendation:        # Agent's reasoning for why this company is interesting
agent_fit_score:             # 1-10, agent's assessment of user fit
user_fit_score:              # 1-10, user's assessment (populated from review feedback)
user_feedback:               # narrative feedback (populated from review feedback)
agent_tags: []
user_tags: []
source:                      # agent-discovery | user-added
discovered_at:
---
```

Key design decisions:
- All fields optional except `type` and `name`
- No body sections — frontmatter only. User can add body content later if they want.
- `agent_tags` and `user_tags` are separate arrays (not a single merged array)
- No `status` field (that's for job reqs, not companies)
- No `uses_ai` or `ai_focus` fields (too hard for agent to reliably assess)
- No `sectors` field — replaced by flexible `agent_tags`

### Updated Google.md

Update the existing Google.md to match the new schema. Keep `type: company` and `name: Google`. Set `domain: google.com`. Leave other fields empty. Remove all body sections.

## Files to Modify

1. `data/careerlaunch-agent-mk3jq2dqjbfy/_templates/company.md` — Replace entirely with new template
2. `data/careerlaunch-agent-mk3jq2dqjbfy/companies/Google.md` — Update to new schema

## Verification

- Read both files after editing
- Confirm valid YAML frontmatter (no syntax errors)
- Confirm no body sections remain
- Confirm all expected fields are present in template
