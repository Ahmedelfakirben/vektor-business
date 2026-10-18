-- 1. Add fiscal flag to treasury movements
ALTER TABLE public.mouvements_tresorerie ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN DEFAULT false;

-- 2. Add fiscal flag to accounting entries
ALTER TABLE public.ecritures_comptables ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN DEFAULT false;

-- 3. Modernized trg_handle_paiement
CREATE OR REPLACE FUNCTION public.trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  mvt_type VARCHAR;
  is_documented BOOLEAN;
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

    -- FETCH FISCAL FLAG EXPLICITLY (Using := to avoid parser confusion with INTO TABLE)
    is_documented := (
      CASE doc_type
        WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = doc_id)
        WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = doc_id)
        WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = doc_id)
        WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = doc_id)
        WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = doc_id)
        ELSE false
      END
    );

    -- Update Treasury Movement
    INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
    VALUES (NEW.tresorerie_id, mvt_type, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, COALESCE(is_documented, false));
    
    IF mvt_type = 'entree' THEN
      UPDATE public.tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
    ELSE
      UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
       UPDATE public.tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
    ELSE
       UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
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

-- 4. Update trg_generate_ecriture_vente
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_vente() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_client_val UUID;
  compte_vente_val UUID;
  compte_tva_val UUID;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    journal_id_val := public.get_journal_id('VTE');
    compte_client_val := public.get_compte_id('3421');
    compte_vente_val := public.get_compte_id('7111');
    compte_tva_val := public.get_compte_id('4455');

    INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
    VALUES (CURRENT_DATE, journal_id_val, 'Facture N° ' || NEW.numero, 'bon_livraison', NEW.id, 'valide', NEW.inclure_tva)
    RETURNING id INTO ecriture_id_val;

    INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (ecriture_id_val, compte_client_val, NEW.montant_ttc, 0, 'Client ' || NEW.client_id);

    IF NEW.montant_ht > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_vente_val, 0, NEW.montant_ht, 'Vente Marchandises');
    END IF;

    IF NEW.montant_tva > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_tva_val, 0, NEW.montant_tva, 'TVA Facturée');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update trg_generate_ecriture_achat
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_achat() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_fournisseur_val UUID;
  compte_achat_val UUID;
  compte_tva_val UUID;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    journal_id_val := public.get_journal_id('ACH');
    compte_fournisseur_val := public.get_compte_id('4411');
    compte_achat_val := public.get_compte_id('6111');
    compte_tva_val := public.get_compte_id('3455');

    INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
    VALUES (CURRENT_DATE, journal_id_val, 'Facture Achat N° ' || NEW.numero, 'bon_achat', NEW.id, 'valide', NEW.inclure_tva)
    RETURNING id INTO ecriture_id_val;

    IF NEW.montant_ht > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_achat_val, NEW.montant_ht, 0, 'Achat Marchandises');
    END IF;

    IF NEW.montant_tva > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_tva_val, NEW.montant_tva, 0, 'TVA Récupérable');
    END IF;

    INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (ecriture_id_val, compte_fournisseur_val, 0, NEW.montant_ttc, 'Fournisseur');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Update trg_generate_ecriture_paiement
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_paiement() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_tiers_val UUID;
  compte_treso_val UUID;
  treso_type_val VARCHAR;
  is_documented BOOLEAN;
BEGIN
  -- Safe scalar assignment to avoid parser confusion with SELECT INTO
  treso_type_val := (SELECT type FROM public.tresoreries WHERE id = NEW.tresorerie_id);
  
  is_documented := (
    CASE NEW.reference_type
      WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = NEW.reference_id)
      WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = NEW.reference_id)
      WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = NEW.reference_id)
      WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = NEW.reference_id)
      WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = NEW.reference_id)
      ELSE false
    END
  );

  IF treso_type_val = 'banque' THEN
    journal_id_val := public.get_journal_id('BNQ');
    compte_treso_val := public.get_compte_id('5141');
  ELSE
    journal_id_val := public.get_journal_id('CAI');
    compte_treso_val := public.get_compte_id('5161');
  END IF;

  INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
  VALUES (NEW.date::date, journal_id_val, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, 'valide', COALESCE(is_documented, false))
  RETURNING id INTO ecriture_id_val;

  IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
     compte_tiers_val := public.get_compte_id('3421');
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_treso_val, NEW.montant, 0);
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_tiers_val, 0, NEW.montant);
  ELSE 
     compte_tiers_val := public.get_compte_id('4411');
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_tiers_val, NEW.montant, 0);
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_treso_val, 0, NEW.montant);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Update v_grand_livre
DROP VIEW IF EXISTS public.v_grand_livre CASCADE;
CREATE OR REPLACE VIEW public.v_grand_livre AS
SELECT 
    l.id,
    e.date,
    j.code as journal_code,
    e.libelle as ecriture_libelle,
    e.reference_type,
    e.reference_id,
    e.inclure_tva,
    pay.reference_type as pay_doc_type,
    pay.reference_id as pay_doc_id,
    p.compte,
    p.libelle as compte_libelle,
    l.debit,
    l.credit,
    l.libelle as ligne_libelle
FROM public.lignes_ecriture l
JOIN public.ecritures_comptables e ON l.ecriture_id = e.id
JOIN public.plan_comptable p ON l.compte_id = p.id
JOIN public.journaux j ON e.journal_id = j.id
LEFT JOIN public.paiements pay ON (e.reference_type = 'paiement' AND e.reference_id = pay.id)
WHERE e.statut = 'valide';

GRANT SELECT ON public.v_grand_livre TO authenticated;
GRANT SELECT ON public.v_grand_livre TO service_role;

-- 8. v_balance_generale_fiscal
DROP VIEW IF EXISTS public.v_balance_generale_fiscal CASCADE;
CREATE OR REPLACE VIEW public.v_balance_generale_fiscal AS
SELECT 
    p.id as compte_id,
    p.compte,
    p.libelle,
    p.classe,
    COALESCE(SUM(l.debit), 0) as total_debit,
    COALESCE(SUM(l.credit), 0) as total_credit,
    COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as solde
FROM public.plan_comptable p
LEFT JOIN public.lignes_ecriture l ON p.id = l.compte_id
LEFT JOIN public.ecritures_comptables e ON l.ecriture_id = e.id
WHERE (e.statut = 'valide' AND e.inclure_tva = true) OR e.id IS NULL
GROUP BY p.id, p.compte, p.libelle, p.classe;

GRANT SELECT ON public.v_balance_generale_fiscal TO authenticated;
GRANT SELECT ON public.v_balance_generale_fiscal TO service_role;
