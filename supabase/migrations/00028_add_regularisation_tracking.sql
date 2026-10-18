-- 00028_add_regularisation_tracking.sql
-- Add flag to identify documents and lines that bypass stock checks for balancing.

ALTER TABLE devis ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bon_livraisons ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_livraison_lignes ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;

-- Index for traceability view performance
CREATE INDEX IF NOT EXISTS idx_bl_regularisation ON bon_livraisons(is_regularisation) WHERE is_regularisation = true;
CREATE INDEX IF NOT EXISTS idx_devis_regularisation ON devis(is_regularisation) WHERE is_regularisation = true;
