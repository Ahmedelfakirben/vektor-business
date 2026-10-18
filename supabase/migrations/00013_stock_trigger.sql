-- Trigger: Sync Stock from Movements
-- This ensures that any direct insert into 'mouvements_stock' updates the 'stock' table.

CREATE OR REPLACE FUNCTION sync_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_sync_stock ON mouvements_stock;
CREATE TRIGGER trg_sync_stock
  AFTER INSERT ON mouvements_stock
  FOR EACH ROW EXECUTE FUNCTION sync_stock_from_movement();
