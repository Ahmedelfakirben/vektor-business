-- Migration 00034: Robust Stock Management via Line and Header Triggers
-- This fix ensures that stock is updated correctly regardless of whether a document
-- is created as 'valide' immediately or validated later, and handles line modifications.

--------------------------------------------------------------------------------
-- 1. BON D'ACHAT (BA)
--------------------------------------------------------------------------------

-- Trigger for Bon Achat Lignes
CREATE OR REPLACE FUNCTION public.trg_bon_achat_ligne_stock_handler()
RETURNS TRIGGER AS $$
DECLARE
  v_statut document_statut;
  v_depot_id UUID;
  v_inclure_tva BOOLEAN;
BEGIN
  -- Get parent info
  SELECT statut, depot_id, inclure_tva INTO v_statut, v_depot_id, v_inclure_tva 
  FROM public.bon_achats WHERE id = COALESCE(NEW.bon_achat_id, OLD.bon_achat_id);

  IF v_statut = 'valide' THEN
    IF (TG_OP = 'INSERT') THEN
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'entree', 'bon_achat', NEW.bon_achat_id, v_inclure_tva);
    ELSIF (TG_OP = 'DELETE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'sortie', 'bon_achat', OLD.bon_achat_id, v_inclure_tva);
    ELSIF (TG_OP = 'UPDATE') THEN
      -- Revert old quantity, apply new quantity
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'sortie', 'bon_achat', OLD.bon_achat_id, v_inclure_tva);
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'entree', 'bon_achat', NEW.bon_achat_id, v_inclure_tva);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_achat_ligne_stock ON public.bon_achat_lignes;
CREATE TRIGGER trg_bon_achat_ligne_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.bon_achat_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bon_achat_ligne_stock_handler();

-- Trigger for Bon Achat Header (Transitions)
CREATE OR REPLACE FUNCTION public.on_bon_achat_statut_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Transition: Brouillon -> Valide (Apply all lines)
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_achat', NEW.id, NEW.inclure_tva)
    FROM public.bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
  
  -- Transition: Valide -> Annule/Brouillon (Revert all lines)
  ELSIF OLD.statut = 'valide' AND NEW.statut IN ('annule', 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'sortie', 'bon_achat', OLD.id, OLD.inclure_tva)
    FROM public.bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
    
  -- Depot change while valid (Move stock between depots)
  ELSIF NEW.statut = 'valide' AND OLD.statut = 'valide' AND NEW.depot_id <> OLD.depot_id THEN
    -- Revert from old depot
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'sortie', 'bon_achat', OLD.id, OLD.inclure_tva)
    FROM public.bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
    -- Apply to new depot
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_achat', NEW.id, NEW.inclure_tva)
    FROM public.bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_achat_stock ON public.bon_achats;
CREATE TRIGGER trg_bon_achat_stock
  AFTER UPDATE ON public.bon_achats
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_achat_statut_change();


--------------------------------------------------------------------------------
-- 2. BON DE LIVRAISON (BL)
--------------------------------------------------------------------------------

-- Trigger for Bon Livraison Lignes
CREATE OR REPLACE FUNCTION public.trg_bon_livraison_ligne_stock_handler()
RETURNS TRIGGER AS $$
DECLARE
  v_statut document_statut;
  v_depot_id UUID;
  v_inclure_tva BOOLEAN;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  -- Get parent info
  SELECT statut, depot_id, inclure_tva INTO v_statut, v_depot_id, v_inclure_tva 
  FROM public.bon_livraisons WHERE id = COALESCE(NEW.bon_livraison_id, OLD.bon_livraison_id);

  IF v_statut = 'valide' THEN
    -- Check stock sufficiency for INSERT or UPDATE (increasing quantity)
    IF (TG_OP IN ('INSERT', 'UPDATE')) THEN
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = NEW.article_id AND depot_id = v_depot_id), 0);
      -- If update, we only check the difference
      IF TG_OP = 'UPDATE' AND NEW.article_id = OLD.article_id THEN
        v_q_dispo := v_q_dispo + OLD.quantite;
      END IF;
      
      IF v_q_dispo < NEW.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = NEW.article_id);
        RAISE EXCEPTION 'Stock insuffisant para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, NEW.quantite;
      END IF;
    END IF;

    IF (TG_OP = 'INSERT') THEN
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'sortie', 'bon_livraison', NEW.bon_livraison_id, v_inclure_tva);
    ELSIF (TG_OP = 'DELETE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'entree', 'bon_livraison', OLD.bon_livraison_id, v_inclure_tva);
    ELSIF (TG_OP = 'UPDATE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'entree', 'bon_livraison', OLD.bon_livraison_id, v_inclure_tva);
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'sortie', 'bon_livraison', NEW.bon_livraison_id, v_inclure_tva);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_livraison_ligne_stock ON public.bon_livraison_lignes;
CREATE TRIGGER trg_bon_livraison_ligne_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.bon_livraison_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bon_livraison_ligne_stock_handler();

-- Trigger for Bon Livraison Header (Transitions)
CREATE OR REPLACE FUNCTION public.on_bon_livraison_statut_change()
RETURNS TRIGGER AS $$
DECLARE
  l_rec RECORD;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  -- Transition: Brouillon -> Valide (Apply all lines with guard)
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    FOR l_rec IN SELECT * FROM public.bon_livraison_lignes WHERE bon_livraison_id = NEW.id AND article_id IS NOT NULL LOOP
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id), 0);
      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;
      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_livraison', NEW.id, NEW.inclure_tva);
    END LOOP;
  
  -- Transition: Valide -> Annule/Brouillon (Revert all lines)
  ELSIF OLD.statut = 'valide' AND NEW.statut IN ('annule', 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'entree', 'bon_livraison', OLD.id, OLD.inclure_tva)
    FROM public.bon_livraison_lignes l WHERE l.bon_livraison_id = NEW.id AND l.article_id IS NOT NULL;
    
  -- Depot change while valid
  ELSIF NEW.statut = 'valide' AND OLD.statut = 'valide' AND NEW.depot_id <> OLD.depot_id THEN
    -- Revert from old depot
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'entree', 'bon_livraison', OLD.id, OLD.inclure_tva)
    FROM public.bon_livraison_lignes l WHERE l.bon_livraison_id = NEW.id AND l.article_id IS NOT NULL;
    -- Apply to new depot (with guard)
    FOR l_rec IN SELECT * FROM public.bon_livraison_lignes WHERE bon_livraison_id = NEW.id AND article_id IS NOT NULL LOOP
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id), 0);
      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant en nouveau depot para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;
      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_livraison', NEW.id, NEW.inclure_tva);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_livraison_stock ON public.bon_livraisons;
CREATE TRIGGER trg_bon_livraison_stock
  AFTER UPDATE ON public.bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_livraison_statut_change();


--------------------------------------------------------------------------------
-- 3. BON DE RETOUR (BR) - CLIENT
--------------------------------------------------------------------------------

-- Trigger for Bon Retour Lignes
CREATE OR REPLACE FUNCTION public.trg_bon_retour_ligne_stock_handler()
RETURNS TRIGGER AS $$
DECLARE
  v_statut document_statut;
  v_depot_id UUID;
  v_inclure_tva BOOLEAN;
BEGIN
  SELECT statut, depot_id, inclure_tva INTO v_statut, v_depot_id, v_inclure_tva 
  FROM public.bon_retours WHERE id = COALESCE(NEW.bon_retour_id, OLD.bon_retour_id);

  IF v_statut = 'valide' THEN
    IF (TG_OP = 'INSERT') THEN
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'entree', 'bon_retour', NEW.bon_retour_id, v_inclure_tva);
    ELSIF (TG_OP = 'DELETE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'sortie', 'bon_retour', OLD.bon_retour_id, v_inclure_tva);
    ELSIF (TG_OP = 'UPDATE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'sortie', 'bon_retour', OLD.bon_retour_id, v_inclure_tva);
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'entree', 'bon_retour', NEW.bon_retour_id, v_inclure_tva);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_ligne_stock ON public.bon_retour_lignes;
CREATE TRIGGER trg_bon_retour_ligne_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.bon_retour_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bon_retour_ligne_stock_handler();

-- Trigger for Bon Retour Header
CREATE OR REPLACE FUNCTION public.on_bon_retour_statut_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_retour', NEW.id, NEW.inclure_tva)
    FROM public.bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  ELSIF OLD.statut = 'valide' AND NEW.statut IN ('annule', 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'sortie', 'bon_retour', OLD.id, OLD.inclure_tva)
    FROM public.bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  ELSIF NEW.statut = 'valide' AND OLD.statut = 'valide' AND NEW.depot_id <> OLD.depot_id THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'sortie', 'bon_retour', OLD.id, OLD.inclure_tva)
    FROM public.bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
    PERFORM public.update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_retour', NEW.id, NEW.inclure_tva)
    FROM public.bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_stock ON public.bon_retours;
CREATE TRIGGER trg_bon_retour_stock
  AFTER UPDATE ON public.bon_retours
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_retour_statut_change();


--------------------------------------------------------------------------------
-- 4. BON DE RETOUR ACHAT (BRA)
--------------------------------------------------------------------------------

-- Trigger for Bon Retour Achat Lignes
CREATE OR REPLACE FUNCTION public.trg_bon_retour_achat_ligne_stock_handler()
RETURNS TRIGGER AS $$
DECLARE
  v_statut document_statut;
  v_depot_id UUID;
  v_inclure_tva BOOLEAN;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  SELECT statut, depot_id, inclure_tva INTO v_statut, v_depot_id, v_inclure_tva 
  FROM public.bon_retour_achats WHERE id = COALESCE(NEW.bon_retour_achat_id, OLD.bon_retour_achat_id);

  IF v_statut = 'valide' THEN
    IF (TG_OP IN ('INSERT', 'UPDATE')) THEN
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = NEW.article_id AND depot_id = v_depot_id), 0);
      IF TG_OP = 'UPDATE' AND NEW.article_id = OLD.article_id THEN v_q_dispo := v_q_dispo + OLD.quantite; END IF;
      IF v_q_dispo < NEW.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = NEW.article_id);
        RAISE EXCEPTION 'Stock insuffisant para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, NEW.quantite;
      END IF;
    END IF;

    IF (TG_OP = 'INSERT') THEN
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'sortie', 'bon_retour_achat', NEW.bon_retour_achat_id, v_inclure_tva);
    ELSIF (TG_OP = 'DELETE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'entree', 'bon_retour_achat', OLD.bon_retour_achat_id, v_inclure_tva);
    ELSIF (TG_OP = 'UPDATE') THEN
      PERFORM public.update_stock(OLD.article_id, v_depot_id, OLD.quantite, 'entree', 'bon_retour_achat', OLD.bon_retour_achat_id, v_inclure_tva);
      PERFORM public.update_stock(NEW.article_id, v_depot_id, NEW.quantite, 'sortie', 'bon_retour_achat', NEW.bon_retour_achat_id, v_inclure_tva);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_achat_ligne_stock ON public.bon_retour_achat_lignes;
CREATE TRIGGER trg_bon_retour_achat_ligne_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.bon_retour_achat_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bon_retour_achat_ligne_stock_handler();

-- Trigger for Bon Retour Achat Header
CREATE OR REPLACE FUNCTION public.on_bon_retour_achat_statut_change()
RETURNS TRIGGER AS $$
DECLARE
  l_rec RECORD;
  v_q_dispo DECIMAL;
  v_a_nm VARCHAR;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    FOR l_rec IN SELECT * FROM public.bon_retour_achat_lignes WHERE bon_retour_achat_id = NEW.id AND article_id IS NOT NULL LOOP
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id), 0);
      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;
      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_retour_achat', NEW.id, NEW.inclure_tva);
    END LOOP;
  ELSIF OLD.statut = 'valide' AND NEW.statut IN ('annule', 'brouillon') THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'entree', 'bon_retour_achat', OLD.id, OLD.inclure_tva)
    FROM public.bon_retour_achat_lignes l WHERE l.bon_retour_achat_id = NEW.id AND l.article_id IS NOT NULL;
  ELSIF NEW.statut = 'valide' AND OLD.statut = 'valide' AND NEW.depot_id <> OLD.depot_id THEN
    PERFORM public.update_stock(l.article_id, OLD.depot_id, l.quantite, 'entree', 'bon_retour_achat', OLD.id, OLD.inclure_tva)
    FROM public.bon_retour_achat_lignes l WHERE l.bon_retour_achat_id = NEW.id AND l.article_id IS NOT NULL;
    FOR l_rec IN SELECT * FROM public.bon_retour_achat_lignes WHERE bon_retour_achat_id = NEW.id AND article_id IS NOT NULL LOOP
      v_q_dispo := COALESCE((SELECT quantite FROM public.stock WHERE article_id = l_rec.article_id AND depot_id = NEW.depot_id), 0);
      IF v_q_dispo < l_rec.quantite THEN
        v_a_nm := (SELECT designation FROM public.articles WHERE id = l_rec.article_id);
        RAISE EXCEPTION 'Stock insuffisant en nouveau depot para % (Dispo: %, Requis: %)', v_a_nm, v_q_dispo, l_rec.quantite;
      END IF;
      PERFORM public.update_stock(l_rec.article_id, NEW.depot_id, l_rec.quantite, 'sortie', 'bon_retour_achat', NEW.id, NEW.inclure_tva);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bon_retour_achat_stock ON public.bon_retour_achats;
CREATE TRIGGER trg_bon_retour_achat_stock
  AFTER UPDATE ON public.bon_retour_achats
  FOR EACH ROW EXECUTE FUNCTION public.on_bon_retour_achat_statut_change();
