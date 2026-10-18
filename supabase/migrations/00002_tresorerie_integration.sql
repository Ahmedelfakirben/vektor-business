-- ============================================================
-- Migration: Intégration Trésorerie sur tous les documents
-- ============================================================

-- 1. Ajouter tresorerie_id et mode_paiement aux tables de documents
-- (optionnels pour rétrocompatibilité avec les documents existants)

ALTER TABLE bon_livraisons
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_retours
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_achats
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_retour_achats
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

-- ============================================================
-- 2. Trigger: Bon de livraison validé → entrée de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_livraison_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    -- Créer mouvement d'entrée
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Bon de livraison ' || NEW.numero, 'bon_livraison', NEW.id);
    -- Mettre à jour le solde
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bl_tresorerie ON bon_livraisons;
CREATE TRIGGER trg_bl_tresorerie
  AFTER UPDATE ON bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION trg_bon_livraison_tresorerie();

-- ============================================================
-- 3. Trigger: Bon de retour validé → sortie de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_retour_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon de retour ' || NEW.numero, 'bon_retour', NEW.id);
    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_br_tresorerie ON bon_retours;
CREATE TRIGGER trg_br_tresorerie
  AFTER UPDATE ON bon_retours
  FOR EACH ROW EXECUTE FUNCTION trg_bon_retour_tresorerie();

-- ============================================================
-- 4. Trigger: Bon d'achat validé → sortie de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon d''achat ' || NEW.numero, 'bon_achat', NEW.id);
    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ba_tresorerie ON bon_achats;
CREATE TRIGGER trg_ba_tresorerie
  AFTER UPDATE ON bon_achats
  FOR EACH ROW EXECUTE FUNCTION trg_bon_achat_tresorerie();

-- ============================================================
-- 5. Trigger: Bon de retour achat validé → entrée de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_retour_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Retour achat ' || NEW.numero, 'bon_retour_achat', NEW.id);
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bra_tresorerie ON bon_retour_achats;
CREATE TRIGGER trg_bra_tresorerie
  AFTER UPDATE ON bon_retour_achats
  FOR EACH ROW EXECUTE FUNCTION trg_bon_retour_achat_tresorerie();
