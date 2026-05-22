-- =============================================================================
-- Skyland Dashboard v1 — Migration 007
-- Syfte: Lagra strukturerad extraherad CRM-data från voice call transcripts
-- =============================================================================

ALTER TABLE voice_calls
    ADD COLUMN IF NOT EXISTS extracted_data jsonb DEFAULT '{}'::jsonb;
