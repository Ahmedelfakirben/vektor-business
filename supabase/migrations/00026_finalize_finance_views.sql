-- 1. Optimized Index for Portfolio management using the committed enum value
DROP INDEX IF EXISTS idx_paiements_echeance;
CREATE INDEX IF NOT EXISTS idx_paiements_echeance ON public.paiements(date_echeance) WHERE mode_paiement IN ('cheque', 'effet');

-- 2. Finance Portfolio View
CREATE OR REPLACE VIEW public.vw_portefeuille AS
SELECT 
    p.*,
    CASE 
        WHEN p.reference_type = 'bon_livraison' THEN (SELECT raison_sociale FROM public.clients c JOIN public.bon_livraisons doc ON c.id = doc.client_id WHERE doc.id = p.reference_id)
        WHEN p.reference_type = 'bon_achat' THEN (SELECT raison_sociale FROM public.fournisseurs f JOIN public.bon_achats doc ON f.id = doc.fournisseur_id WHERE doc.id = p.reference_id)
        -- Add others as needed
    END as tiers_nom
FROM public.paiements p
WHERE p.mode_paiement IN ('cheque', 'effet');

-- 3. Permissions
GRANT SELECT ON public.vw_portefeuille TO authenticated;
