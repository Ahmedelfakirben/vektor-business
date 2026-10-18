-- ============================================================
-- Update Treasury Triggers to support late payments
-- (When adding payment info to an already validated document)
-- ============================================================

-- 1. Bon de Livraison
CREATE OR REPLACE FUNCTION trg_bon_livraison_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger if:
  -- 1. Status changes to 'valide' AND treasery is set (Immediate payment)
  -- 2. Status is already 'valide' AND treasury changes from NULL to SET (Late payment)
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    -- Créer mouvement d'entrée
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Bon de livraison ' || NEW.numero, 'bon_livraison', NEW.id);

    -- Mettre à jour le solde
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Bon de Retour
CREATE OR REPLACE FUNCTION trg_bon_retour_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon de retour ' || NEW.numero, 'bon_retour', NEW.id);

    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Bon d'Achat
CREATE OR REPLACE FUNCTION trg_bon_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon d''achat ' || NEW.numero, 'bon_achat', NEW.id);

    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Bon Retour Achat
CREATE OR REPLACE FUNCTION trg_bon_retour_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Retour achat ' || NEW.numero, 'bon_retour_achat', NEW.id);

    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
