-- 00022_fix_stock_logic.sql
-- 1. Add fiscal stock column
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS quantite_fiscale DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 2. Refactor update_stock to avoid double-counting
CREATE OR REPLACE FUNCTION public.update_stock(
  p_article_id UUID,
  p_depot_id UUID,
  p_quantite DECIMAL,
  p_type mouvement_type,
  p_ref_type VARCHAR,
  p_ref_id UUID,
  p_inclure_tva BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
  -- Log the movement in the mouvements table ONLY.
  -- The 'stock' table update is handled solely by the trg_sync_stock trigger on mouvements_stock.
  INSERT INTO public.mouvements_stock (article_id, depot_id, type, quantite, reference_type, reference_id, inclure_tva)
  VALUES (p_article_id, p_depot_id, p_type, p_quantite, p_ref_type, p_ref_id, p_inclure_tva);
END;
$$ LANGUAGE plpgsql;

-- 3. Update the sole source of truth trigger function
CREATE OR REPLACE FUNCTION public.sync_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update Global Stock using 'ON CONFLICT'
  INSERT INTO public.stock (article_id, depot_id, quantite, quantite_fiscale)
  VALUES (NEW.article_id, NEW.depot_id, 
    CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END,
    CASE WHEN NEW.inclure_tva = true THEN (CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END) ELSE 0 END
  )
  ON CONFLICT (article_id, depot_id)
  DO UPDATE SET 
    quantite = stock.quantite + (CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END),
    quantite_fiscale = stock.quantite_fiscale + (
      CASE WHEN NEW.inclure_tva = true 
      THEN (CASE WHEN NEW.type = 'entree' THEN NEW.quantite ELSE -NEW.quantite END) 
      ELSE 0 END
    );
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add the Negative Stock Guard for Bon de Livraison
CREATE OR REPLACE FUNCTION public.on_bon_livraison_valide()
RETURNS TRIGGER AS $$
DECLARE
  l_rec RECORD;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    FOR l_rec IN SELECT * FROM public.bon_livraison_lignes WHERE bon_livraison_id = NEW.id AND article_id IS NOT NULL LOOP
      
      -- Assignment using := to avoid 'INTO' keyword ambiguity in some SQL editors
      v_q_dispo := COALESCE((
        SELECT quantite 
        FROM public.stock 
        WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id
      ), 0);

      -- Block if stock is insufficient
      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant pour % (Dispo: %, Requis: %)', 
          v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;

      -- Use the refactored update_stock which doesn't double-count
      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_livraison', NEW.id, NEW.inclure_tva);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Implement POS Stock Deduction
CREATE OR REPLACE FUNCTION public.trg_vente_pos_stock_handler()
RETURNS TRIGGER AS $$
DECLARE
  v_d_id UUID;
  v_i_t BOOLEAN;
BEGIN
  -- Assignment using SELECT INTO is usually safe here, but using simple assignment for safety
  v_d_id := (SELECT depot_id FROM public.ventes_pos WHERE id = NEW.vente_pos_id);
  v_i_t := COALESCE((SELECT inclure_tva FROM public.ventes_pos WHERE id = NEW.vente_pos_id), false);

  IF v_d_id IS NOT NULL THEN
    PERFORM public.update_stock(NEW.article_id, v_d_id, NEW.quantite, 'sortie', 'vente_pos', NEW.id, v_i_t);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vente_pos_stock ON public.vente_pos_lignes;
CREATE TRIGGER trg_vente_pos_stock
  AFTER INSERT ON public.vente_pos_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_vente_pos_stock_handler();
