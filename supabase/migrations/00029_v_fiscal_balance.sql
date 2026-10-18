-- 00029_v_fiscal_balance.sql
-- Create a comprehensive view to identify physical and fiscal stock discrepancies.

CREATE OR REPLACE VIEW v_fiscal_balance AS
WITH stats AS (
    SELECT 
        article_id,
        depot_id,
        -- Total Physical Stock
        SUM(CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) as stock_physique,
        -- Official Stock (With TVA)
        SUM(CASE WHEN inclure_tva = true THEN (CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) ELSE 0 END) as stock_tva,
        -- Informal Stock (Without TVA)
        SUM(CASE WHEN inclure_tva = false THEN (CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) ELSE 0 END) as stock_hors_tva
    FROM mouvements_stock
    GROUP BY article_id, depot_id
)
SELECT 
    s.*,
    a.code as article_code,
    a.designation as article_designation,
    d.libelle as depot_libelle,
    -- Flags for discrepancies
    (s.stock_physique < 0) as deficit_physique,
    (s.stock_tva < 0) as deficit_fiscal,
    (s.stock_hors_tva < 0) as deficit_informel
FROM stats s
JOIN articles a ON s.article_id = a.id
JOIN depots d ON s.depot_id = d.id;

-- Grant access
GRANT SELECT ON v_fiscal_balance TO authenticated;
GRANT SELECT ON v_fiscal_balance TO service_role;
