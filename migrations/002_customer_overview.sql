-- =============================================================================
-- Skyland Dashboard v1 — Migration 002
-- Skapar:     customers, companies, projects
-- Modifierar: prospects (+ customer_id)
--             activity_log (+ customer_id, company_id, project_id)
-- Seed:       4 customers, 5 companies, 6 projects (migrerat från engagements)
-- Behåller:   engagements — dropas i 003 efter v1-verifiering i drift
-- =============================================================================

-- -----------------------------------------------
-- 1. CUSTOMERS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name   text        NOT NULL,
    email       text,
    phone       text,
    notes       text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_full_name ON customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_created   ON customers(created_at DESC);

-- -----------------------------------------------
-- 2. COMPANIES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    org_number  text,
    industry    text,
    website     text,
    notes       text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_customer_id ON companies(customer_id);
CREATE INDEX IF NOT EXISTS idx_companies_created     ON companies(created_at DESC);

-- -----------------------------------------------
-- 3. PROJECTS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id           uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   uuid                   NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name         text                   NOT NULL,
    project_type engagement_client_type NOT NULL,
    status       engagement_status      NOT NULL DEFAULT 'lead',
    next_step    text,
    notes        text,
    created_at   timestamptz            DEFAULT now(),
    updated_at   timestamptz            DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created    ON projects(created_at DESC);

-- -----------------------------------------------
-- 4. MODIFY PROSPECTS — länka konverterade prospects till customer
-- -----------------------------------------------
ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_customer_id ON prospects(customer_id);

-- -----------------------------------------------
-- 5. MODIFY ACTIVITY_LOG — länka till nya tabeller
-- -----------------------------------------------
ALTER TABLE activity_log
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id  uuid REFERENCES projects(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_company  ON activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_project  ON activity_log(project_id);

-- -----------------------------------------------
-- 6. TRIGGERS — auto-uppdatera updated_at
--    update_updated_at()-funktionen finns sedan 001
-- -----------------------------------------------
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------
-- 7. RLS — customers, companies, projects
--    Samma mönster som engagements i 001
-- -----------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects  ENABLE ROW LEVEL SECURITY;

-- customers
DROP POLICY IF EXISTS "auth_select_customers" ON customers;
CREATE POLICY "auth_select_customers" ON customers
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_customers" ON customers;
CREATE POLICY "auth_insert_customers" ON customers
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_customers" ON customers;
CREATE POLICY "auth_update_customers" ON customers
    FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete_customers" ON customers;
CREATE POLICY "auth_delete_customers" ON customers
    FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "deny_all_anon_customers" ON customers;
CREATE POLICY "deny_all_anon_customers" ON customers
    FOR ALL TO anon USING (false);

-- companies
DROP POLICY IF EXISTS "auth_select_companies" ON companies;
CREATE POLICY "auth_select_companies" ON companies
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_companies" ON companies;
CREATE POLICY "auth_insert_companies" ON companies
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_companies" ON companies;
CREATE POLICY "auth_update_companies" ON companies
    FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete_companies" ON companies;
CREATE POLICY "auth_delete_companies" ON companies
    FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "deny_all_anon_companies" ON companies;
CREATE POLICY "deny_all_anon_companies" ON companies
    FOR ALL TO anon USING (false);

-- projects
DROP POLICY IF EXISTS "auth_select_projects" ON projects;
CREATE POLICY "auth_select_projects" ON projects
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_projects" ON projects;
CREATE POLICY "auth_insert_projects" ON projects
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_projects" ON projects;
CREATE POLICY "auth_update_projects" ON projects
    FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete_projects" ON projects;
CREATE POLICY "auth_delete_projects" ON projects
    FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "deny_all_anon_projects" ON projects;
CREATE POLICY "deny_all_anon_projects" ON projects
    FOR ALL TO anon USING (false);

-- -----------------------------------------------
-- 8. DATA-MIGRATION
--    4 customers → 5 companies → 6 projects
--    Enum-värden: 'ai-system', 'hemsida' (lowercase, som i 001)
-- -----------------------------------------------
DO $$
DECLARE
    -- Customers
    cust_axel    uuid := gen_random_uuid();
    cust_thomas  uuid := gen_random_uuid();
    cust_bjorn   uuid := gen_random_uuid();
    cust_gustav  uuid := gen_random_uuid();

    -- Companies
    comp_hasselblad     uuid := gen_random_uuid();
    comp_marinmekaniker uuid := gen_random_uuid();
    comp_bjorn_olsson   uuid := gen_random_uuid();
    comp_cold_exp       uuid := gen_random_uuid();
    comp_tankreng       uuid := gen_random_uuid();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM customers) THEN
        -- 4 customers
        INSERT INTO customers (id, full_name) VALUES
            (cust_axel,   'Axel'),
            (cust_thomas, 'Thomas'),
            (cust_bjorn,  'Björn Olsson'),
            (cust_gustav, 'Gustav');

        -- 5 companies
        INSERT INTO companies (id, customer_id, name, industry) VALUES
            (comp_hasselblad,     cust_axel,   'Hasselblads Livs',  'Livsmedel'),
            (comp_marinmekaniker, cust_thomas, 'MarinMekaniker',    'Marin service'),
            (comp_bjorn_olsson,   cust_bjorn,  'Björn Olsson',      'Artist'),
            (comp_cold_exp,       cust_gustav, 'Cold Experience',   'Event/Upplevelser'),
            (comp_tankreng,       cust_gustav, 'Tankrengöring.se',  'Industriservice');

        -- 6 projects
        INSERT INTO projects (company_id, name, project_type, status, next_step) VALUES
            (comp_hasselblad,     'AI-system',     'ai-system', 'i drift',   NULL),
            (comp_marinmekaniker, 'AI-system',     'ai-system', 'i drift',   NULL),
            (comp_bjorn_olsson,   'Hemsida',       'hemsida',   'levererat', NULL),
            (comp_cold_exp,       'Hemsida fas 1', 'hemsida',   'levererat', NULL),
            (comp_cold_exp,       'Hemsida fas 2', 'hemsida',   'lead',      'Diskuteras på Öckerö-möte'),
            (comp_tankreng,       'Hemsida',       'hemsida',   'lead',      'Scope diskuteras på Öckerö-möte');
    END IF;
END $$;

-- =============================================================================
-- VERIFIERINGS-QUERIES — kör manuellt efter migration
-- =============================================================================

-- Antal rader per tabell — förväntat: 4, 5, 6
-- SELECT 'customers' AS table_name, count(*) FROM customers
-- UNION ALL SELECT 'companies', count(*) FROM companies
-- UNION ALL SELECT 'projects',  count(*) FROM projects;

-- Full hierarki — förväntat: 6 rader, Gustav visas 3 gånger
-- SELECT c.full_name, co.name AS company, p.name AS project, p.status
-- FROM customers c
-- JOIN companies co ON co.customer_id = c.id
-- JOIN projects p ON p.company_id = co.id
-- ORDER BY c.full_name, co.name, p.name;
