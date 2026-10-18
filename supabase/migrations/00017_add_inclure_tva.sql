-- Ajouter la colonne inclure_tva aux tables de documents
ALTER TABLE devis ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_livraisons ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_retours ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_commandes ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_achats ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_retour_achats ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ventes_pos ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN NOT NULL DEFAULT false;

-- Mettre à jour les types pour inclure ce nouveau champ (si nécessaire pour introspection, bien que Supabase le fasse auto)
COMMENT ON COLUMN devis.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
COMMENT ON COLUMN bon_livraisons.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
COMMENT ON COLUMN bon_retours.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
COMMENT ON COLUMN bon_commandes.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
COMMENT ON COLUMN bon_achats.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
COMMENT ON COLUMN bon_retour_achats.inclure_tva IS 'Indique si la TVA doit être calculée e affichée dans le document';
