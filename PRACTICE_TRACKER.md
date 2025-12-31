# Practice Tracker (Obi-Wan System)

**Status:** ✅ Ready to use
**URL:** `/practice/` (will be `http://localhost:8888/practice/` when server is running)

## What Was Built

A minimal practice tracking system with:
- Simple form to log practices
- Optional fields: practice name, duration, reflection
- **Obi-Wan occasionally appears** (~1 in 7 chance) with wisdom
- Thumbs up/down feedback on Obi-Wan's messages
- Simple success message when Obi-Wan doesn't appear
- **Practice history list view** - see all your past check-ins
- All data stored in SQLite (no data loss!)

## Files Created/Modified

### Database Schema
- `db/schema.sql` - Added `practices` table with:
  - id, practice_name, duration, reflection, obi_wan_message, obi_wan_feedback, timestamp

### Database Helpers
- `db/helpers.js` - Added:
  - `insertPractice()` - Save a practice entry
  - `getPracticeCount()` - Get total count
  - `getRecentPractices()` - Get recent entries
  - `updatePracticeFeedback()` - Update thumbs up/down

### API Endpoints
- `netlify/functions/practice-submit.js` - Handle practice submissions
- `netlify/functions/practice-feedback.js` - Handle thumbs up/down feedback
- `netlify/functions/practice-list.js` - Fetch practice history

### Frontend
- `src/practice.njk` - Practice tracking page with form and Obi-Wan response
- `src/practices.njk` - Practice history list view

## How to Use

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Visit the practice tracker:**
   - Log practice: `http://localhost:8888/practice/`
   - View history: `http://localhost:8888/practices/`

3. **Log a practice:**
   - (Optional) Enter practice name
   - (Optional) Enter duration in minutes
   - (Optional) Enter reflection
   - Click "I Did It ✓"

4. **After logging:**
   - **Most times:** Simple "Practice Logged ✓" success message
   - **Occasionally (~1 in 7):** Obi-Wan appears with wisdom
   - First practice: Obi-Wan always appears with "journey starts" message
   - Give thumbs up/down feedback to help Obi-Wan learn
   - Click "Log Another Practice" to continue

## Data Storage

All practices are stored in:
```
/Users/erik/Sites/habitualos/data/habitualos.db
```

The `practices` table structure:
```sql
CREATE TABLE practices (
  id TEXT PRIMARY KEY,
  practice_name TEXT,
  duration INTEGER,
  reflection TEXT,
  obi_wan_message TEXT,
  obi_wan_feedback TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
```

## Next Steps (Future)

- [x] View past practices (simple list/feed) ✓
- [ ] Visualization (stacking stones, flower petals, etc.)
- [ ] Intelligent Obi-Wan synthesis (pattern detection)
- [ ] More encouragement messages based on feedback data

## Notes

- **Data is persistent** - stored in SQLite, never lost
- **No authentication** - single user (you)
- **No gamification** - intentionally simple and non-demanding
- **Obi-Wan is rare** - appears ~14% of the time (1 in 7), making it special
- **Feedback learning** - thumbs up/down stored for future message improvements
- **Not a success message** - Obi-Wan's appearance replaces the system success message
