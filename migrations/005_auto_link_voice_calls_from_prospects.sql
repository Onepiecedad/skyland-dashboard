-- =============================================================================
-- Skyland Dashboard v1 — Migration 005
-- Syfte: Auto-koppla voice_calls och voice interactions till prospects/customers
--        när en prospect skapas eller senare konverteras till customer.
-- Nyckel: session_uuid
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_voice_links_from_prospect()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_uuid IS NULL THEN
        RETURN NEW;
    END IF;

    -- Koppla specialiserade voice_calls-rader till prospect/kund.
    UPDATE voice_calls
    SET
        prospect_id = NEW.id,
        customer_id = NEW.customer_id,
        updated_at = NOW()
    WHERE session_uuid = NEW.session_uuid
      AND (
        prospect_id IS DISTINCT FROM NEW.id
        OR customer_id IS DISTINCT FROM NEW.customer_id
      );

    -- Håll även interactions-spegeln i sync för eventuella timeline-vyer.
    UPDATE interactions
    SET payload = jsonb_set(
        jsonb_set(
            COALESCE(payload, '{}'::jsonb),
            '{prospect_id}',
            to_jsonb(NEW.id),
            true
        ),
        '{customer_id}',
        to_jsonb(NEW.customer_id),
        true
    )
    WHERE session_uuid = NEW.session_uuid
      AND type = 'voice';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_voice_links_from_prospect_on_insert ON prospects;
CREATE TRIGGER sync_voice_links_from_prospect_on_insert
    AFTER INSERT ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION sync_voice_links_from_prospect();

DROP TRIGGER IF EXISTS sync_voice_links_from_prospect_on_update ON prospects;
CREATE TRIGGER sync_voice_links_from_prospect_on_update
    AFTER UPDATE OF customer_id ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION sync_voice_links_from_prospect();

-- Backfill redan sparade samtal som nu kan kopplas via prospect.session_uuid.
UPDATE voice_calls vc
SET
    prospect_id = p.id,
    customer_id = p.customer_id,
    updated_at = NOW()
FROM prospects p
WHERE vc.session_uuid = p.session_uuid
  AND (
    vc.prospect_id IS DISTINCT FROM p.id
    OR vc.customer_id IS DISTINCT FROM p.customer_id
  );

UPDATE interactions i
SET payload = jsonb_set(
    jsonb_set(
        COALESCE(i.payload, '{}'::jsonb),
        '{prospect_id}',
        to_jsonb(p.id),
        true
    ),
    '{customer_id}',
    to_jsonb(p.customer_id),
    true
)
FROM prospects p
WHERE i.session_uuid = p.session_uuid
  AND i.type = 'voice';
