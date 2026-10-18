-- 1. Add 'effet' to mode_paiement enum
-- (Note: In some Postgres environments this must be run outside a transaction)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'mode_paiement' AND e.enumlabel = 'effet') THEN
        ALTER TYPE public.mode_paiement ADD VALUE 'effet';
    END IF;
END $$;

-- 2. Update paiements table for advanced tracking
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS date_echeance DATE; -- For Cheques and Effects
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS reference_paiement TEXT; -- For Transaction Ref or Cheque No
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS statut_versement TEXT DEFAULT 'encaisse'; -- 'encaisse', 'rejete', 'en_attente'

-- Index for Portfolio management (Temporal simple index to avoid enum usage error in transaction)
CREATE INDEX IF NOT EXISTS idx_paiements_echeance ON public.paiements(date_echeance);

-- 3. Upgrade traceability to multi-code supporting arrays
-- Tables: BL, BA, BR, BRA, Devis, BC
DO $$
DECLARE
    row RECORD;
    v_table_name TEXT;
    document_line_tables TEXT[] := ARRAY[
        'bon_livraison_lignes', 
        'bon_achat_lignes', 
        'bon_retour_lignes', 
        'bon_retour_achat_lignes', 
        'devis_lignes', 
        'bon_commande_lignes',
        'vente_pos_lignes'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY document_line_tables LOOP
        -- Add codes_articles as TEXT array
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS codes_articles TEXT[] DEFAULT ARRAY[]::TEXT[]', v_table_name);
        
        -- Migrate data if code_article exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'code_article') THEN
            EXECUTE format('UPDATE public.%I SET codes_articles = ARRAY[code_article] WHERE code_article IS NOT NULL AND (codes_articles IS NULL OR array_length(codes_articles, 1) IS NULL)', v_table_name);
        END IF;
    END LOOP;
END $$;

-- 4. Improve Stock View by adding article attributes
-- We'll create or update the helper for fetching stock with attributes
CREATE OR REPLACE VIEW public.vw_stock_detaille AS
SELECT 
    s.*,
    a.code as article_code,
    a.designation as article_designation,
    a.prix_achat as article_prix_achat,
    a.prix_vente as article_prix_vente,
    a.seuil_alerte as article_seuil_alerte,
    f.libelle as famille,
    sf.libelle as sous_famille,
    d.libelle as depot_libelle,
    (s.quantite * a.prix_achat) as valeur_achat_totale,
    (s.quantite * a.prix_vente) as valeur_vente_totale
FROM public.stock s
JOIN public.articles a ON s.article_id = a.id
LEFT JOIN public.familles_articles f ON a.famille_id = f.id
LEFT JOIN public.sous_familles_articles sf ON a.sous_famille_id = sf.id
JOIN public.depots d ON s.depot_id = d.id;

GRANT SELECT ON public.vw_stock_detaille TO authenticated;
