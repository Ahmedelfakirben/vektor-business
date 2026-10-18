-- 1. Create sub-families table
CREATE TABLE IF NOT EXISTS public.sous_familles_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    famille_id UUID NOT NULL REFERENCES public.familles_articles(id) ON DELETE CASCADE,
    libelle TEXT NOT NULL,
    description TEXT,
    type_code_requis TEXT, -- e.g. 'IMEI', 'Serial Number', 'Batch'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Update articles table to link to sub-families
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS sous_famille_id UUID REFERENCES public.sous_familles_articles(id) ON DELETE SET NULL;

-- 3. Create Expenses (Dépenses) table
CREATE TABLE IF NOT EXISTS public.depenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    categorie TEXT NOT NULL, -- 'Loyer', 'Salaire', 'Internet', 'Electricité', 'Autre'
    montant DECIMAL(15,2) NOT NULL DEFAULT 0,
    tresorerie_id UUID NOT NULL REFERENCES public.tresoreries(id),
    notes TEXT,
    inclure_tva BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.sous_familles_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies
CREATE POLICY "Allow all for authenticated" ON public.sous_familles_articles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public.depenses FOR ALL TO authenticated USING (true);

-- 6. Add 'code_article' to document lines for traceability
ALTER TABLE public.bon_livraison_lignes ADD COLUMN IF NOT EXISTS code_article TEXT;
ALTER TABLE public.bon_achat_lignes ADD COLUMN IF NOT EXISTS code_article TEXT;
ALTER TABLE public.bon_retour_lignes ADD COLUMN IF NOT EXISTS code_article TEXT;
ALTER TABLE public.bon_retour_achat_lignes ADD COLUMN IF NOT EXISTS code_article TEXT;
ALTER TABLE public.devis_lignes ADD COLUMN IF NOT EXISTS code_article TEXT;

-- 7. Trigger for Expenses to update Treasury
CREATE OR REPLACE FUNCTION public.trg_handle_depense()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Create a treasury movement
        INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
        VALUES (NEW.tresorerie_id, 'sortie', NEW.montant, 'Dépense: ' || NEW.categorie || ' (' || NEW.numero || ')', 'depense', NEW.id, NEW.inclure_tva);
        
        -- Update solde
        UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
        IF NEW.inclure_tva THEN
            UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - NEW.montant WHERE id = NEW.tresorerie_id;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        -- Revert solde
        UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
        IF OLD.inclure_tva THEN
            UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + OLD.montant WHERE id = OLD.tresorerie_id;
        END IF;
        
        DELETE FROM public.mouvements_tresorerie WHERE reference_type = 'depense' AND reference_id = OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_depense_after
AFTER INSERT OR DELETE ON public.depenses
FOR EACH ROW EXECUTE FUNCTION public.trg_handle_depense();

-- 8. Grant permissions
GRANT ALL ON public.sous_familles_articles TO authenticated;
GRANT ALL ON public.depenses TO authenticated;
GRANT ALL ON public.sous_familles_articles TO service_role;
GRANT ALL ON public.depenses TO service_role;
