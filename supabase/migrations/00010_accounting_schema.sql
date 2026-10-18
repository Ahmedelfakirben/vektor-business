-- ============================================================
-- Migration: Module Comptabilité (PCGM - Maroc)
-- ============================================================

-- 1. Plan Comptable
CREATE TABLE plan_comptable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compte VARCHAR(20) NOT NULL UNIQUE, -- 3421, 4411, etc.
    libelle VARCHAR(255) NOT NULL,
    classe INTEGER NOT NULL, -- 1 à 8
    parent_id UUID REFERENCES plan_comptable(id),
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Journaux Comptables
CREATE TABLE journaux (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE, -- ACH, VTE, BNQ, OD, AN
    libelle VARCHAR(100) NOT NULL,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Journaux (Standard)
INSERT INTO journaux (code, libelle) VALUES
('ACH', 'Achats'),
('VTE', 'Ventes'),
('BNQ', 'Banque'),
('CAI', 'Caisse'),
('OD', 'Opérations Diverses'),
('AN', 'À Nouveaux');

-- 3. Écritures Comptables (Header)
-- Lien vers la pièce source (Facture id, Paiement id)
CREATE TABLE ecritures_comptables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    journal_id UUID NOT NULL REFERENCES journaux(id),
    libelle VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50), -- bon_livraison, bon_achat, paiement
    reference_id UUID,
    statut VARCHAR(20) DEFAULT 'brouillon', -- brouillon, valide
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Lignes d'Écriture (Detail)
CREATE TABLE lignes_ecriture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecriture_id UUID NOT NULL REFERENCES ecritures_comptables(id) ON DELETE CASCADE,
    compte_id UUID NOT NULL REFERENCES plan_comptable(id),
    libelle VARCHAR(255), -- Optionnel, hérite souvent de l'écriture
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit > 0 OR credit > 0)
);

-- Indexes
CREATE INDEX idx_ecritures_date ON ecritures_comptables(date);
CREATE INDEX idx_ecritures_ref ON ecritures_comptables(reference_type, reference_id);
CREATE INDEX idx_lignes_compte ON lignes_ecriture(compte_id);

-- RLS
ALTER TABLE plan_comptable ENABLE ROW LEVEL SECURITY;
ALTER TABLE journaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecritures_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_ecriture ENABLE ROW LEVEL SECURITY;

-- Policies (Full Access for authenticated users for now)
CREATE POLICY "Full Access Plan Comptable" ON plan_comptable FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full Access Journaux" ON journaux FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full Access Ecritures" ON ecritures_comptables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full Access Lignes" ON lignes_ecriture FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Seed Data: Plan Comptable Marocain (Extrait Essentiel)
-- ============================================================
-- Classe 1: Financement Permanent
-- Classe 2: Actif Immobilisé
-- Classe 3: Actif Circulant
-- Classe 4: Passif Circulant
-- Classe 5: Trésorerie
-- Classe 6: Charges
-- Classe 7: Produits

INSERT INTO plan_comptable (compte, libelle, classe) VALUES
-- Classe 3 (Clients & Comptes rattachés)
('3421', 'Clients', 3),
('3425', 'Clients - Retenues de garantie', 3),
('3455', 'État - TVA récupérable', 3),

-- Classe 4 (Fournisseurs & Comptes rattachés)
('4411', 'Fournisseurs', 4),
('4455', 'État - TVA facturée', 4),
('4456', 'État - TVA due', 4),

-- Classe 5 (Trésorerie)
('5141', 'Banques (soldes débiteurs)', 5),
('5161', 'Caisses', 5),

-- Classe 6 (Charges)
('6111', 'Achats de marchandises', 6),
('6114', 'Variation des stocks de marchandises', 6),
('6121', 'Achats de matières premières', 6),

-- Classe 7 (Produits)
('7111', 'Ventes de marchandises', 7),
('7121', 'Ventes de biens et services produits', 7);

