-- ============================================================
-- Migration: Triggers Comptables (Automatisation PCGM)
-- ============================================================

-- Helper helper to get account ID by code
CREATE OR REPLACE FUNCTION get_compte_id(p_code VARCHAR) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM plan_comptable WHERE compte = p_code;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Helper to get Journal ID by code
CREATE OR REPLACE FUNCTION get_journal_id(p_code VARCHAR) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM journaux WHERE code = p_code;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Trigger: Validation Bon de Livraison (Vente)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_generate_ecriture_vente() RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_ecriture_id UUID;
  v_compte_client UUID;
  v_compte_vente UUID;
  v_compte_tva UUID;
  v_montant_ht DECIMAL(15,2);
  v_montant_tva DECIMAL(15,2);
BEGIN
  -- Only run when status becomes 'valide'
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    
    v_journal_id := get_journal_id('VTE');
    v_compte_client := get_compte_id('3421'); -- Clients
    v_compte_vente := get_compte_id('7111');  -- Vente Marchandises
    v_compte_tva := get_compte_id('4455');    -- TVA Facturée

    -- Create Header
    INSERT INTO ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut)
    VALUES (CURRENT_DATE, v_journal_id, 'Facture N° ' || NEW.numero, 'bon_livraison', NEW.id, 'valide')
    RETURNING id INTO v_ecriture_id;

    -- USE EXACT AMOUNTS FROM DOCUMENT
    v_montant_ht := NEW.montant_ht;
    v_montant_tva := NEW.montant_tva;

    -- Ligne 1: Débit Client (TTC)
    INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (v_ecriture_id, v_compte_client, NEW.montant_ttc, 0, 'Client ' || NEW.client_id); -- client_id is uuid

    -- Ligne 2: Crédit Vente (HT)
    IF v_montant_ht > 0 THEN
      INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (v_ecriture_id, v_compte_vente, 0, v_montant_ht, 'Vente Marchandises');
    END IF;

    -- Ligne 3: Crédit TVA (TVA)
    IF v_montant_tva > 0 THEN
      INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (v_ecriture_id, v_compte_tva, 0, v_montant_tva, 'TVA Facturée');
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_compta_vente
  AFTER UPDATE ON bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION trg_generate_ecriture_vente();

-- ============================================================
-- 2. Trigger: Validation Bon d'Achat (Achat)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_generate_ecriture_achat() RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_ecriture_id UUID;
  v_compte_fournisseur UUID;
  v_compte_achat UUID;
  v_compte_tva UUID;
  v_montant_ht DECIMAL(15,2);
  v_montant_tva DECIMAL(15,2);
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    
    v_journal_id := get_journal_id('ACH');
    v_compte_fournisseur := get_compte_id('4411'); -- Fournisseurs
    v_compte_achat := get_compte_id('6111');       -- Achats Marchandises
    v_compte_tva := get_compte_id('3455');         -- TVA Récupérable

    INSERT INTO ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut)
    VALUES (CURRENT_DATE, v_journal_id, 'Facture Achat N° ' || NEW.numero, 'bon_achat', NEW.id, 'valide')
    RETURNING id INTO v_ecriture_id;

    -- USE EXACT AMOUNTS FROM DOCUMENT
    v_montant_ht := NEW.montant_ht;
    v_montant_tva := NEW.montant_tva;

    -- Ligne 1: Débit Achat (HT)
    IF v_montant_ht > 0 THEN
      INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (v_ecriture_id, v_compte_achat, v_montant_ht, 0, 'Achat Marchandises');
    END IF;

    -- Ligne 2: Débit TVA (TVA)
    IF v_montant_tva > 0 THEN
      INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (v_ecriture_id, v_compte_tva, v_montant_tva, 0, 'TVA Récupérable');
    END IF;

    -- Ligne 3: Crédit Fournisseur (TTC)
    INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (v_ecriture_id, v_compte_fournisseur, 0, NEW.montant_ttc, 'Fournisseur');

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_compta_achat
  AFTER UPDATE ON bon_achats
  FOR EACH ROW EXECUTE FUNCTION trg_generate_ecriture_achat();

-- ============================================================
-- 3. Trigger: Paiement (Trésorerie)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_generate_ecriture_paiement() RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_ecriture_id UUID;
  v_compte_tiers UUID; -- Client or Fournisseur
  v_compte_treso UUID; -- Banque or Caisse
  v_treso_type VARCHAR;
BEGIN
  -- Determine Journal (BNQ or CAI based on treasury type)
  -- Need to fetch tresorerie type
  SELECT type INTO v_treso_type FROM tresoreries WHERE id = NEW.tresorerie_id;
  
  IF v_treso_type = 'banque' THEN
    v_journal_id := get_journal_id('BNQ');
    v_compte_treso := get_compte_id('5141');
  ELSE
    v_journal_id := get_journal_id('CAI'); -- Ensure 'CAI' exists in seed
    v_compte_treso := get_compte_id('5161');
  END IF;

  INSERT INTO ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut)
  VALUES (NEW.date::date, v_journal_id, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, 'valide')
  RETURNING id INTO v_ecriture_id;

  IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
     -- Encaissement
     v_compte_tiers := get_compte_id('3421'); -- Client

     -- Débit Treso
     INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (v_ecriture_id, v_compte_treso, NEW.montant, 0);

     -- Crédit Client
     INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (v_ecriture_id, v_compte_tiers, 0, NEW.montant);

  ELSE 
     -- Décaissement
     v_compte_tiers := get_compte_id('4411'); -- Fournisseur

     -- Débit Fournisseur
     INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (v_ecriture_id, v_compte_tiers, NEW.montant, 0);

     -- Crédit Treso
     INSERT INTO lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (v_ecriture_id, v_compte_treso, 0, NEW.montant);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_compta_paiement
  AFTER INSERT ON paiements
  FOR EACH ROW EXECUTE FUNCTION trg_generate_ecriture_paiement();
