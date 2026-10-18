-- Improved RPC to calculate stock filtered by fiscal status with rich entity data
DROP FUNCTION IF EXISTS public.get_fiscal_stock(UUID);

CREATE OR REPLACE FUNCTION public.get_fiscal_stock(p_depot_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    article_id UUID,
    depot_id UUID,
    quantite DECIMAL,
    article_code TEXT,
    article_designation TEXT,
    article_prix_achat DECIMAL,
    article_prix_vente DECIMAL,
    article_tva INTEGER,
    famille_libelle TEXT,
    sous_famille_libelle TEXT,
    depot_libelle TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gen_random_uuid() as id,
        m.article_id,
        m.depot_id,
        SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END) as quantite,
        a.code as article_code,
        a.designation as article_designation,
        a.prix_achat as article_prix_achat,
        a.prix_vente as article_prix_vente,
        a.tva as article_tva,
        f.libelle as famille_libelle,
        sf.libelle as sous_famille_libelle,
        d.libelle as depot_libelle
    FROM public.mouvements_stock m
    JOIN public.articles a ON m.article_id = a.id
    LEFT JOIN public.familles_articles f ON a.famille_id = f.id
    LEFT JOIN public.sous_familles_articles sf ON a.sous_famille_id = sf.id
    JOIN public.depots d ON m.depot_id = d.id
    WHERE m.inclure_tva = true
    AND (p_depot_id IS NULL OR m.depot_id = p_depot_id)
    GROUP BY m.article_id, m.depot_id, a.id, f.id, sf.id, d.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_fiscal_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fiscal_stock(UUID) TO service_role;
