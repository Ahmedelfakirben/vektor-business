-- Update accept_devis and validate_bon_commande to carry over the inclure_tva flag

-- 1. Update accept_devis
CREATE OR REPLACE FUNCTION accept_devis(p_devis_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_devis RECORD;
  v_bl_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Get Devis
  SELECT * INTO v_devis FROM devis WHERE id = p_devis_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable'; END IF;

  -- Allow re-accepting if BL doesn't exist (idempotency fix for partial failures)
  IF v_devis.statut = 'accepte' AND EXISTS (SELECT 1 FROM bon_livraisons WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Ce devis a déjà été accepté et un BL existe déjà.';
  END IF;

  -- 2. Update status
  UPDATE devis SET statut = 'accepte' WHERE id = p_devis_id;

  -- 3. Get numero
  SELECT next_numero('bon_livraison') INTO v_numero;

  -- 4. Create BL (carrying over inclure_tva)
  INSERT INTO bon_livraisons (
    numero, date, client_id, devis_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes, inclure_tva
  ) VALUES (
    v_numero, CURRENT_DATE, v_devis.client_id, p_devis_id, p_depot_id, 'brouillon',
    v_devis.montant_ht, v_devis.montant_tva, v_devis.montant_ttc,
    'Créé automatiquement depuis devis ' || v_devis.numero,
    v_devis.inclure_tva
  ) RETURNING id INTO v_bl_id;

  -- 5. Copy lines
  INSERT INTO bon_livraison_lignes (
    bon_livraison_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_bl_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM devis_lignes
  WHERE devis_id = p_devis_id;

  RETURN jsonb_build_object('success', true, 'bl_id', v_bl_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update validate_bon_commande
CREATE OR REPLACE FUNCTION validate_bon_commande(p_bc_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bc RECORD;
  v_ba_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Récupérer le BC
  SELECT * INTO v_bc FROM bon_commandes WHERE id = p_bc_id;
  
  IF v_bc IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable';
  END IF;

  -- 2. Vérifier si déjà validé (ou reçu)
  IF v_bc.statut = 'recu' AND EXISTS (SELECT 1 FROM bon_achats WHERE bon_commande_id = p_bc_id) THEN
    RAISE EXCEPTION 'Ce bon de commande a déjà été validé et un BA existe déjà.';
  END IF;

  -- 3. VALIDATION ATOMIQUE --
  
  -- A. Mettre à jour le statut du BC (Final Status = 'recu')
  UPDATE bon_commandes SET statut = 'recu' WHERE id = p_bc_id;
  
  -- B. Créer le Bon d'Achat (Brouillon) (carrying over inclure_tva)
  SELECT next_numero('bon_achat') INTO v_numero;

  INSERT INTO bon_achats (
    numero, date, fournisseur_id, bon_commande_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes, inclure_tva
  ) VALUES (
    v_numero, CURRENT_DATE, v_bc.fournisseur_id, p_bc_id, p_depot_id, 'brouillon',
    v_bc.montant_ht, v_bc.montant_tva, v_bc.montant_ttc,
    'Créé automatiquement depuis BC ' || v_bc.numero,
    v_bc.inclure_tva
  ) RETURNING id INTO v_ba_id;

  INSERT INTO bon_achat_lignes (
    bon_achat_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_ba_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM bon_commande_lignes
  WHERE bon_commande_id = p_bc_id;

  RETURN jsonb_build_object('success', true, 'ba_id', v_ba_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
