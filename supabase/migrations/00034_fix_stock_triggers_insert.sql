-- Migration 00034: Fix Stock Triggers to handle INSERT and avoid OLD record errors
-- This fix ensures that when a document (BA, BL, BR, BRA) is created directly as 'valide', 
-- the stock is updated immediately.

-- 1. Update Bon d'Achat trigger and function
CREATE OR REPLACE FUNCTION public.on_bon_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status is validated (either on insert or on update from non-valide)
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'valide') THEN
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_achat', NEW.id, NEW.inclure_tva)
    FROM public.bon_achat_lignes l 
    WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_achat_stock ON public.bon_achats;
CREATE TRIGGER trg_bon_achat_stock
  AFTER INSERT OR UPDATE ON public.bon_achats
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_achat_valide();


-- 2. Update Bon de Livraison trigger and function
CREATE OR REPLACE FUNCTION public.on_bon_livraison_valide()
RETURNS TRIGGER AS $$
DECLARE
  l_rec RECORD;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  -- Check if status is validated
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'valide') THEN
    FOR l_rec IN SELECT * FROM public.bon_livraison_lignes WHERE bon_livraison_id = NEW.id AND article_id IS NOT NULL LOOP
      
      -- Stock check
      v_q_dispo := COALESCE((
        SELECT quantite 
        FROM public.stock 
        WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id
      ), 0);

      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant pour % (Dispo: %, Requis: %)', 
          v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;

      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_livraison', NEW.id, NEW.inclure_tva);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_livraison_stock ON public.bon_livraisons;
CREATE TRIGGER trg_bon_livraison_stock
  AFTER INSERT OR UPDATE ON public.bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_livraison_valide();


-- 3. Update Bon de Retour trigger and function
CREATE OR REPLACE FUNCTION public.on_bon_retour_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'valide') THEN
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_retour', NEW.id, NEW.inclure_tva)
    FROM public.bon_retour_lignes l 
    WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_stock ON public.bon_retours;
CREATE TRIGGER trg_bon_retour_stock
  AFTER INSERT OR UPDATE ON public.bon_retours
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_retour_valide();


-- 4. Update Bon de Retour Achat trigger and function
CREATE OR REPLACE FUNCTION public.on_bon_retour_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'valide') THEN
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'sortie', 'bon_retour_achat', NEW.id, NEW.inclure_tva)
    FROM public.bon_retour_achat_lignes l 
    WHERE l.bon_retour_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_achat_stock ON public.bon_retour_achats;
CREATE TRIGGER trg_bon_retour_achat_stock
  AFTER INSERT OR UPDATE ON public.bon_retour_achats
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_retour_achat_valide();
