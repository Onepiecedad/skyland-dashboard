-- =============================================================================
-- Migration 003 — Lägg till source-kolumn på prospects
-- Möjliga värden: 'facebook', 'facebook_ads', 'hemsida', 'website',
--                 'ai_agent', 'email', 'manual'
-- =============================================================================

ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source);

-- Sätt befintliga leads med session_uuid till 'ai_agent' som default-gissning
-- (de kom in via AI-agentens formulär). Justera manuellt vid behov.
UPDATE prospects
    SET source = 'ai_agent'
    WHERE source IS NULL AND session_uuid IS NOT NULL;

-- =============================================================================
-- VERIFIERING — kör manuellt efter migration
-- =============================================================================
-- SELECT source, count(*) FROM prospects GROUP BY source ORDER BY count DESC;
