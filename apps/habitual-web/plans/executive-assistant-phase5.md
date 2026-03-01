# Executive Assistant - Phase 5: Enhancements + Migration

## Context

We've built the core EA system:
- Phase 1: Data layer + EA agent logic
- Phase 2: Dashboard + Log Work UI
- Phase 3: EA Chat UI
- Phase 4: Supporting pages (history, projects, project detail)

This phase focuses on enhancements and migrating existing data into the new model.

## Enhancement Options

### 1. Auto-Migrate Existing Agent North Stars to Projects

The user has existing agents with north star goals:
- Career Launch → Project
- HabitualOS Design → Project
- Balance Cheerleader → Project (or retire?)
- Life Optimization Strategist → Retire (replaced by EA)

**Migration approach**:
```javascript
// One-time script or endpoint
async function migrateAgentsToProjects(userId) {
  const agents = await getAgentsByUserId(userId);

  for (const agent of agents) {
    if (agent.type !== 'executive' && agent.instructions?.goal) {
      await createProject(generateProjectId(), {
        name: agent.name,
        goal: agent.instructions.goal,
        status: agent.status === 'active' ? 'active' : 'paused',
        migratedFromAgentId: agent.id, // Track origin
        _userId: userId
      });
    }
  }
}
```

### 2. Link Actions to Projects

Add optional `projectId` field to actions:
- Update action creation to accept projectId
- Update action display to show project
- EA can suggest which project an action relates to

### 3. Work Visualization (Like Garden)

Create a `/do/garden/` equivalent:
- Visual representation of work logged
- Could show:
  - Blocks/bricks building up (construction metaphor)
  - Progress bars per project
  - Heat map of activity
  - Growth chart over time

### 4. EA Morning Briefing

Auto-generate a daily summary:
- What was worked on yesterday
- Open actions needing attention
- Projects that haven't had activity
- Suggested focus for today

Could be:
- Push notification
- Email digest
- Available in EA chat on request

### 5. Energy Level Tracking

Add energy field to work logs:
```javascript
{
  // existing fields...
  energyBefore: 3, // 1-5 scale
  energyAfter: 4
}
```

EA can:
- Ask "How's your energy?" and record
- Notice patterns (e.g., "I notice you do deep work best in mornings")
- Suggest lighter tasks when energy is low

### 6. Automated Logging Hints

Gentle reminders to log work:
- Browser notification after extended focus time
- End-of-day prompt
- Weekly review prompt

### 7. EA Context Document

Make the EA's "User Context" note more structured:
```javascript
{
  type: "context",
  title: "User Context",
  content: {
    preferences: [...],
    patterns: [...],
    currentFocus: "...",
    energyPatterns: {...},
    lastUpdated: timestamp
  }
}
```

EA actively maintains and references this.

## Decisions to Make with User

- Which enhancements matter most?
- Should existing agents be migrated or kept separate?
- What visualization would be motivating?
- How aggressive should reminders be?
- What's the right balance of automation vs. user control?

## Implementation Notes

This phase is intentionally open-ended. Work with the user to:

1. **Review usage patterns** from Phases 1-4
2. **Identify pain points** - what's not working?
3. **Prioritize enhancements** - what would make the biggest difference?
4. **Iterate** - implement one enhancement at a time, test, refine

## Success Criteria

- [ ] User is actively using the system daily
- [ ] EA provides genuine value in focusing work
- [ ] Work logging feels natural, not burdensome
- [ ] Projects provide useful organization
- [ ] System evolves based on actual usage patterns
