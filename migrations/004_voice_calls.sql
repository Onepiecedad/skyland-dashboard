-- =============================================================================
-- Skyland Dashboard v1 — Migration 004
-- Skapar: voice_calls
-- Syfte: Lagra röstsamtal från ElevenLabs/n8n och visa dem i dashboarden
-- =============================================================================

CREATE TABLE IF NOT EXISTS voice_calls (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_uuid     uuid        REFERENCES sessions(session_uuid) ON DELETE SET NULL,
    prospect_id      uuid        REFERENCES prospects(id) ON DELETE SET NULL,
    customer_id      uuid        REFERENCES customers(id) ON DELETE SET NULL,
    provider         text        NOT NULL DEFAULT 'elevenlabs',
    external_call_id text        NOT NULL,
    call_source      text        DEFAULT 'voice_call_ended',
    agent_id         text,
    started_at       timestamptz,
    ended_at         timestamptz,
    duration_seconds integer,
    transcript       text,
    summary          text,
    recording_url    text,
    metadata         jsonb       DEFAULT '{}'::jsonb,
    raw_payload      jsonb       DEFAULT '{}'::jsonb,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_calls_provider_external_call_id
    ON voice_calls(provider, external_call_id);

CREATE INDEX IF NOT EXISTS idx_voice_calls_session_uuid
    ON voice_calls(session_uuid);

CREATE INDEX IF NOT EXISTS idx_voice_calls_prospect_id
    ON voice_calls(prospect_id);

CREATE INDEX IF NOT EXISTS idx_voice_calls_customer_id
    ON voice_calls(customer_id);

CREATE INDEX IF NOT EXISTS idx_voice_calls_created_at
    ON voice_calls(created_at DESC);

DROP TRIGGER IF EXISTS voice_calls_updated_at ON voice_calls;
CREATE TRIGGER voice_calls_updated_at
    BEFORE UPDATE ON voice_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_voice_calls" ON voice_calls;
CREATE POLICY "auth_select_voice_calls" ON voice_calls
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_voice_calls" ON voice_calls;
CREATE POLICY "auth_update_voice_calls" ON voice_calls
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_voice_calls" ON voice_calls;
CREATE POLICY "auth_delete_voice_calls" ON voice_calls
    FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "deny_all_anon_voice_calls" ON voice_calls;
CREATE POLICY "deny_all_anon_voice_calls" ON voice_calls
    FOR ALL TO anon USING (false);
