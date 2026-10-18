-- Fix Validate BC RPC to use 'recu' status instead of 'valide'
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
  
  -- B. Créer le Bon d'Achat (Brouillon)
  SELECT next_numero('bon_achat') INTO v_numero;

  INSERT INTO bon_achats (
    numero, date, fournisseur_id, bon_commande_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes
  ) VALUES (
    v_numero, CURRENT_DATE, v_bc.fournisseur_id, p_bc_id, p_depot_id, 'brouillon',
    v_bc.montant_ht, v_bc.montant_tva, v_bc.montant_ttc,
    'Créé automatiquement depuis BC ' || v_bc.numero
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
