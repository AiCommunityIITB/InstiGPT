-- Migration 004: Enhanced feedback with reason categories
-- Adds reason and comment columns to feedback table for actionable quality insights.

-- Add reason category to feedback
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reason TEXT CHECK (
    reason IS NULL OR reason IN (
        'wrong_info', 'irrelevant', 'incomplete', 'hallucination', 'outdated'
    )
);

-- Add optional free-text comment for detailed feedback
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS comment TEXT;

-- Index on reason for aggregation queries (e.g., "most common failure mode this week")
CREATE INDEX IF NOT EXISTS idx_feedback_reason ON feedback(reason) WHERE reason IS NOT NULL;

-- Composite index for weekly quality reports: GROUP BY reason, type
CREATE INDEX IF NOT EXISTS idx_feedback_type_reason ON feedback(type, reason);
