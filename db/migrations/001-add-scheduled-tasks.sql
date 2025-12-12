-- Migration: Add scheduled task support to action_cards table
--  Run this to update existing databases

-- Add new columns for scheduled tasks
ALTER TABLE action_cards ADD COLUMN task_type TEXT DEFAULT 'interactive';
ALTER TABLE action_cards ADD COLUMN schedule_time TEXT;
ALTER TABLE action_cards ADD COLUMN task_config TEXT;
ALTER TABLE action_cards ADD COLUMN updated_at TEXT;
ALTER TABLE action_cards ADD COLUMN started_at TEXT;
ALTER TABLE action_cards ADD COLUMN error_message TEXT;

-- Note: completed_at and dismissed_reason already exist
