-- 00030_fix_payments_integrity.sql

-- 1. Ensure inclure_tva exists on ALL document tables to prevent trigger failures
DO $$ 
BEGIN
    -- Devis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.devis ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraisons' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_livraisons ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_achats' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_achats ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BR
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_retours' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_retours ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BRA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_retour_achats' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_retour_achats ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BC
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commandes' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_commandes ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Make the payment trigger more robust by handling missing documents or schema sync lag
CREATE OR REPLACE FUNCTION public.trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  mvt_type public.mouvement_type;
  is_documented BOOLEAN := false;
  doc_type VARCHAR;
  doc_id UUID;
BEGIN
  doc_type := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END);
  doc_id := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END);

  IF (TG_OP = 'INSERT') THEN
    -- Determine movement type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
      mvt_type := 'entree';
    ELSE
      mvt_type := 'sortie';
    END IF;

    -- FETCH FISCAL FLAG EXPLICITLY with safe blocks
    BEGIN
        is_documented := (
          CASE doc_type
            WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = doc_id)
            WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = doc_id)
            WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = doc_id)
            WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = doc_id)
            WHEN 'vente_pos' THEN (SELECT COALESCE(inclure_tva, false) FROM public.ventes_pos WHERE id = doc_id)
            WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = doc_id)
            ELSE false
          END
        );
    EXCEPTION WHEN OTHERS THEN
        is_documented := false; -- Fallback if column still missing during transition
    END;

    -- Update Treasury Movement
    INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
    VALUES (NEW.tresorerie_id, mvt_type, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, COALESCE(is_documented, false));
    
    -- Global Balance Update
    IF mvt_type = 'entree' THEN
      UPDATE public.tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    ELSE
      UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    -- Try to fetch documented flag from movement history
    is_documented := COALESCE((SELECT inclure_tva FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id LIMIT 1), false);
    
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
       UPDATE public.tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    ELSE
       UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    END IF;
    
    DELETE FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  IF doc_type = 'bon_livraison' THEN
      UPDATE public.bon_livraisons SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_achat' THEN
      UPDATE public.bon_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour' THEN
      UPDATE public.bon_retours SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour_achat' THEN
      UPDATE public.bon_retour_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
