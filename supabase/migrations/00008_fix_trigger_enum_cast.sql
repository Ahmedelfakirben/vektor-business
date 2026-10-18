-- Fix trigger function to use correct enum type for status
CREATE OR REPLACE FUNCTION trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  v_ref_table VARCHAR;
  v_ref_id UUID;
  v_montant DECIMAL(14,2);
  v_old_montant DECIMAL(14,2);
  v_type_mvt mouvement_type; -- Changed from VARCHAR to mouvement_type
BEGIN
  -- Determine operation type and values
  IF (TG_OP = 'INSERT') THEN
    v_ref_table := NEW.reference_type || 's'; -- pluralize
    v_ref_id := NEW.reference_id;
    v_montant := NEW.montant;
    
    -- Determine movement type based on doc type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
      v_type_mvt := 'entree';
    ELSE
      v_type_mvt := 'sortie';
    END IF;

    -- Update Treasury
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, v_type_mvt, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id);
    
    IF v_type_mvt = 'entree' THEN
      UPDATE tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
    ELSE
      UPDATE tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    v_ref_table := OLD.reference_type || 's';
    v_ref_id := OLD.reference_id;
    v_montant := -OLD.montant; -- Negative to subtract

    -- Revert Treasury
    -- We need to know what the original movement type was.
    -- Re-derive it logic or fetch from movement.
    -- Re-deriving is safer if movement was deleted manually (unlikely but possible).
    
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
       -- Was entree, now remove it (sortie equivalent logic)
       UPDATE tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
    ELSE
       -- Was sortie, now add it back
       UPDATE tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
    END IF;

    DELETE FROM mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  EXECUTE format('
    WITH total AS (
      SELECT COALESCE(SUM(montant), 0) as ad 
      FROM paiements 
      WHERE reference_type = %L AND reference_id = %L
    )
    UPDATE %I 
    SET 
      montant_regle = total.ad,
      statut_paiement = CASE 
        WHEN total.ad >= montant_ttc THEN ''paye''
        WHEN total.ad > 0 THEN ''partiel''
        ELSE ''impaye''
      END
    FROM total
    WHERE id = %L', 
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type || 's' ELSE NEW.reference_type || 's' END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END)
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
