-- RPC for global search of an article by any code (Barcode, Reference, or Serial Number/IMEI)
-- Fixed syntax using direct assignments (:=) to avoid ambiguity in PL/pgSQL
CREATE OR REPLACE FUNCTION public.find_article_by_code(p_search_code TEXT)
RETURNS TABLE (
    article_id UUID,
    designation TEXT,
    prix_vente DECIMAL,
    tva INTEGER,
    stock_actuel DECIMAL,
    found_via TEXT -- 'direct', 'traceability'
) AS $$
DECLARE
    v_id UUID;
    v_via TEXT;
BEGIN
    -- 1. Search in Articles (Barcode, Reference or Code)
    v_id := (SELECT a.id FROM public.articles a WHERE a.code_barre = p_search_code OR a.reference = p_search_code OR a.code = p_search_code LIMIT 1);
    
    IF v_id IS NOT NULL THEN
        v_via := 'direct';
    ELSE
        -- 2. Search in Traceability (Purchase lines)
        v_id := (SELECT l.article_id FROM public.bon_achat_lignes l WHERE p_search_code = ANY(l.codes_articles) LIMIT 1);
        
        IF v_id IS NULL THEN
            -- 3. Search in Sales lines (Delivery Notes)
            v_id := (SELECT l.article_id FROM public.bon_livraison_lignes l WHERE p_search_code = ANY(l.codes_articles) LIMIT 1);
        END IF;

        IF v_id IS NOT NULL THEN
            v_via := 'traceability';
        END IF;
    END IF;

    -- Return full article information and actual stock
    IF v_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            a.id, 
            a.designation, 
            a.prix_vente, 
            a.tva,
            COALESCE((SELECT SUM(s.quantite) FROM public.stock s WHERE s.article_id = a.id), 0) as stock_actuel,
            v_via
        FROM public.articles a
        WHERE a.id = v_id;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.find_article_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_article_by_code(TEXT) TO service_role;
