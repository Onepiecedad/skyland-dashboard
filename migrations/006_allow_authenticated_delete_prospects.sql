-- =============================================================================
-- Skyland Dashboard v1 — Migration 006
-- Syfte: Tillåt authenticated users att radera prospects från dashboarden
-- =============================================================================

DROP POLICY IF EXISTS "auth_delete_prospects" ON prospects;
CREATE POLICY "auth_delete_prospects" ON prospects
    FOR DELETE TO authenticated USING (true);
