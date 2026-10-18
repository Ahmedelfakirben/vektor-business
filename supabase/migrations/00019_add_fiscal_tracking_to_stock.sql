-- 00019_add_fiscal_tracking_to_stock.sql
-- Add fiscal tracking to stock movements to allow "Factored" vs "Global" stock views.

-- 1. Add column to movements table
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;

-- 2. Update the update_stock logic to handle the fiscal flag
CREATE OR REPLACE FUNCTION update_stock(
  p_article_id UUID,
  p_depot_id UUID,
  p_quantite DECIMAL,
  p_type mouvement_type,
  p_ref_type VARCHAR,
  p_ref_id UUID,
  p_inclure_tva BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
  -- Upsert du stock (The 'stock' table always holds the REAL GLOBAL balance)
  -- Note: We still update the main stock table because it represents physical reality.
  -- But we log the 'inclure_tva' flag in movements for filtered reporting.
  INSERT INTO stock (article_id, depot_id, quantite)
  VALUES (p_article_id, p_depot_id,
    CASE WHEN p_type = 'entree' THEN p_quantite ELSE -p_quantite END
  )
  ON CONFLICT (article_id, depot_id)
  DO UPDATE SET quantite = stock.quantite +
    CASE WHEN p_type = 'entree' THEN p_quantite ELSE -p_quantite END;

  -- Log du mouvement with the fiscal flag
  INSERT INTO mouvements_stock (article_id, depot_id, type, quantite, reference_type, reference_id, inclure_tva)
  VALUES (p_article_id, p_depot_id, p_type, p_quantite, p_ref_type, p_ref_id, p_inclure_tva);
END;
$$ LANGUAGE plpgsql;

-- 3. Update Sync Stock from Movements (if exists from 00013)
-- We need to ensure the trigger function also handles the new column if it inserts manually.
-- However, most movements come from update_stock function.
CREATE OR REPLACE FUNCTION sync_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger is a fallback for direct inserts to mouvements_stock
  -- We don't need to change the 'stock' update logic here as it's always global,
  -- but we ensure the function is aware of the table structure.
  
  -- Check if stock exists and update
  INSERT INTO stock (article_id, depot_id, quantite)
  VALUES (NEW.article_id, NEW.depot_id, 
    CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END
  )
  ON CONFLICT (article_id, depot_id)
  DO UPDATE SET quantite = stock.quantite + 
    CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update Document Triggers to pass the inclure_tva flag

-- Bon de livraison
CREATE OR REPLACE FUNCTION on_bon_livraison_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'sortie', 'bon_livraison', NEW.id, NEW.inclure_tva)
    FROM bon_livraison_lignes l WHERE l.bon_livraison_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bon de retour
CREATE OR REPLACE FUNCTION on_bon_retour_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_retour', NEW.id, NEW.inclure_tva)
    FROM bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bon d'achat
CREATE OR REPLACE FUNCTION on_bon_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_achat', NEW.id, NEW.inclure_tva)
    FROM bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bon de retour achat
CREATE OR REPLACE FUNCTION on_bon_retour_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'sortie', 'bon_retour_achat', NEW.id, NEW.inclure_tva)
    FROM bon_retour_achat_lignes l WHERE l.bon_retour_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
