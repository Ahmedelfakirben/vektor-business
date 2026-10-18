-- View: Articles with aggregated stock
CREATE OR REPLACE VIEW v_articles_avec_stock AS
SELECT 
    a.*,
    COALESCE(SUM(s.quantite), 0) as stock_actuel
FROM articles a
LEFT JOIN stock s ON s.article_id = a.id
GROUP BY a.id;

-- Grant permissions
ALTER VIEW v_articles_avec_stock OWNER TO postgres;
GRANT SELECT ON v_articles_avec_stock TO authenticated;
GRANT SELECT ON v_articles_avec_stock TO service_role;
