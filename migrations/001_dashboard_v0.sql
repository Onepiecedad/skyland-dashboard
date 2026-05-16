-- =============================================================================
-- Skyland Dashboard v0 — Migration
-- Skapar: engagements, activity_log
-- Modifierar: prospects (lägger till status + updated_at)
-- Uppdaterar: RLS-policies för authenticated-åtkomst
--
-- RÖR INTE: prospects befintliga kolumner, interactions, knowledge_base, sessions
-- =============================================================================

-- -----------------------------------------------
-- 1. ENUM-TYPER
-- -----------------------------------------------
CREATE TYPE engagement_client_type AS ENUM (
    'ai-system', 'hemsida', 'automation', 'drift-och-säkerhet', 'konsultation'
);

CREATE TYPE engagement_status AS ENUM (
    'lead', 'pågående', 'levererat', 'i drift', 'pausat', 'avslutat'
);

-- -----------------------------------------------
-- 2. ENGAGEMENTS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS engagements (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name     text        NOT NULL,
    contact_person  text,
    client_type     engagement_client_type NOT NULL,
    status          engagement_status      NOT NULL DEFAULT 'lead',
    next_step       text,
    notes           text,
    prospect_id     uuid        REFERENCES prospects(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_engagements_status ON engagements(status);
CREATE INDEX idx_engagements_client_type ON engagements(client_type);
CREATE INDEX idx_engagements_created ON engagements(created_at DESC);

-- -----------------------------------------------
-- 3. ACTIVITY_LOG
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz DEFAULT now(),
    action          text        NOT NULL,
    description     text,
    prospect_id     uuid        REFERENCES prospects(id) ON DELETE SET NULL,
    engagement_id   uuid        REFERENCES engagements(id) ON DELETE SET NULL,
    actor           text        NOT NULL DEFAULT 'user',
    metadata        jsonb       DEFAULT '{}'::jsonb
);

CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_prospect ON activity_log(prospect_id);
CREATE INDEX idx_activity_engagement ON activity_log(engagement_id);

-- -----------------------------------------------
-- 4. MODIFY PROSPECTS — Lägg till dashboard-fält
-- (Default-värden = void-flödet påverkas inte)
-- -----------------------------------------------
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS status text DEFAULT 'ny';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- -----------------------------------------------
-- 5. TRIGGERS — auto-uppdatera updated_at
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER engagements_updated_at
    BEFORE UPDATE ON engagements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER prospects_updated_at
    BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------
-- 6. RLS — Nya tabeller
-- -----------------------------------------------
ALTER TABLE engagements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log  ENABLE ROW LEVEL SECURITY;

-- Engagements: authenticated full CRUD
CREATE POLICY "auth_select_engagements" ON engagements
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_engagements" ON engagements
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_engagements" ON engagements
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_engagements" ON engagements
    FOR DELETE TO authenticated USING (true);

-- Activity Log: authenticated read + insert (append-only)
CREATE POLICY "auth_select_activity_log" ON activity_log
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_activity_log" ON activity_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- Deny anon (som övriga tabeller)
CREATE POLICY "deny_all_anon_engagements" ON engagements
    FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_anon_activity_log" ON activity_log
    FOR ALL TO anon USING (false);

-- -----------------------------------------------
-- 7. RLS — Uppdatera BEFINTLIGA tabeller
-- Ta bort deny-policies för authenticated på
-- prospects och interactions, ersätt med SELECT/UPDATE
-- -----------------------------------------------

-- prospects: byt från deny → tillåt SELECT + UPDATE
DROP POLICY IF EXISTS "deny_all_auth_prospects" ON prospects;
CREATE POLICY "auth_select_prospects" ON prospects
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_prospects" ON prospects
    FOR UPDATE TO authenticated USING (true);

-- interactions: byt från deny → tillåt SELECT (read-only, för AI-svar)
DROP POLICY IF EXISTS "deny_all_auth_interactions" ON interactions;
CREATE POLICY "auth_select_interactions" ON interactions
    FOR SELECT TO authenticated USING (true);

-- Anon-policies LÄMNAS ORÖRDA (deny_all_anon_*)
-- Service role har implicit full access (bypasses RLS)
-- -----------------------------------------------
