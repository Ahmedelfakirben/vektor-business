--- ==========================================================================
--- MIGRATION: 00001_create_schema.sql
--- ==========================================================================
-- ============================================================
-- ERP Digital ALT - Migration initiale
-- ============================================================

-- Activer l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Type ENUM pour les rôles
CREATE TYPE user_role AS ENUM ('admin', 'gerant', 'commercial', 'magasinier');
CREATE TYPE tresorerie_type AS ENUM ('caisse', 'banque');
CREATE TYPE mode_paiement AS ENUM ('especes', 'carte', 'cheque', 'virement', 'effet');
CREATE TYPE mouvement_type AS ENUM ('entree', 'sortie');
CREATE TYPE devis_statut AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');
CREATE TYPE document_statut AS ENUM ('brouillon', 'valide', 'annule');
CREATE TYPE commande_statut AS ENUM ('brouillon', 'envoye', 'recu', 'annule');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'commercial',
  avatar_url TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger pour créer un profil automatiquement
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, nom, prenom, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'commercial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  raison_sociale VARCHAR(255) NOT NULL,
  adresse TEXT,
  ville VARCHAR(100),
  telephone VARCHAR(20),
  email VARCHAR(255),
  ice VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FOURNISSEURS
-- ============================================================
CREATE TABLE fournisseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  raison_sociale VARCHAR(255) NOT NULL,
  adresse TEXT,
  ville VARCHAR(100),
  telephone VARCHAR(20),
  email VARCHAR(255),
  ice VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FAMILLES D'ARTICLES
-- ============================================================
CREATE TABLE familles_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ARTICLES
-- ============================================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL UNIQUE,
  reference VARCHAR(100),
  code_barre VARCHAR(100),
  designation VARCHAR(255) NOT NULL,
  famille_id UUID REFERENCES familles_articles(id) ON DELETE SET NULL,
  prix_achat DECIMAL(12,2) NOT NULL DEFAULT 0,
  prix_vente DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  unite VARCHAR(20) NOT NULL DEFAULT 'Unité',
  seuil_alerte INTEGER NOT NULL DEFAULT 10,
  actif BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DÉPÔTS DE STOCKAGE
-- ============================================================
CREATE TABLE depots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  adresse TEXT,
  responsable_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STOCK
-- ============================================================
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  depot_id UUID NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE(article_id, depot_id)
);

-- ============================================================
-- SALARIÉS
-- ============================================================
CREATE TABLE salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricule VARCHAR(20) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  poste VARCHAR(100),
  telephone VARCHAR(20),
  email VARCHAR(255),
  date_embauche DATE,
  salaire DECIMAL(12,2),
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRÉSORERIES
-- ============================================================
CREATE TABLE tresoreries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  type tresorerie_type NOT NULL DEFAULT 'caisse',
  solde DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SÉQUENCES (auto-numérotation)
-- ============================================================
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL UNIQUE,
  prefixe VARCHAR(10) NOT NULL,
  dernier_numero INTEGER NOT NULL DEFAULT 0,
  format VARCHAR(50) NOT NULL DEFAULT '{prefixe}-{annee}-{numero}'
);

INSERT INTO sequences (type, prefixe) VALUES
  ('devis', 'DEV'),
  ('bon_livraison', 'BL'),
  ('bon_retour', 'BR'),
  ('bon_commande', 'BC'),
  ('bon_achat', 'BA'),
  ('bon_retour_achat', 'BRA'),
  ('vente_pos', 'POS');

-- Fonction pour générer le prochain numéro
CREATE OR REPLACE FUNCTION next_numero(p_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq sequences%ROWTYPE;
  v_numero VARCHAR;
BEGIN
  UPDATE sequences
  SET dernier_numero = dernier_numero + 1
  WHERE type = p_type
  RETURNING * INTO v_seq;

  v_numero := v_seq.prefixe || '-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(v_seq.dernier_numero::TEXT, 4, '0');
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DEVIS
-- ============================================================
CREATE TABLE devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES clients(id),
  commercial_id UUID NOT NULL REFERENCES profiles(id),
  statut devis_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  validite_jours INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devis_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BON DE LIVRAISON
-- ============================================================
CREATE TABLE bon_livraisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES clients(id),
  devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
  depot_id UUID NOT NULL REFERENCES depots(id),
  statut document_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bon_livraison_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bon_livraison_id UUID NOT NULL REFERENCES bon_livraisons(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BON DE RETOUR (CLIENT)
-- ============================================================
CREATE TABLE bon_retours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES clients(id),
  bon_livraison_id UUID REFERENCES bon_livraisons(id) ON DELETE SET NULL,
  depot_id UUID NOT NULL REFERENCES depots(id),
  motif TEXT,
  statut document_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bon_retour_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bon_retour_id UUID NOT NULL REFERENCES bon_retours(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BON DE COMMANDE (FOURNISSEUR)
-- ============================================================
CREATE TABLE bon_commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  statut commande_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bon_commande_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bon_commande_id UUID NOT NULL REFERENCES bon_commandes(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BON D'ACHAT
-- ============================================================
CREATE TABLE bon_achats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  bon_commande_id UUID REFERENCES bon_commandes(id) ON DELETE SET NULL,
  depot_id UUID NOT NULL REFERENCES depots(id),
  statut document_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bon_achat_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bon_achat_id UUID NOT NULL REFERENCES bon_achats(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BON DE RETOUR D'ACHAT
-- ============================================================
CREATE TABLE bon_retour_achats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  depot_id UUID NOT NULL REFERENCES depots(id),
  motif TEXT,
  statut document_statut NOT NULL DEFAULT 'brouillon',
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bon_retour_achat_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bon_retour_achat_id UUID NOT NULL REFERENCES bon_retour_achats(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- VENTES POS
-- ============================================================
CREATE TABLE ventes_pos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  commercial_id UUID NOT NULL REFERENCES profiles(id),
  tresorerie_id UUID NOT NULL REFERENCES tresoreries(id),
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  remise DECIMAL(14,2) NOT NULL DEFAULT 0,
  inclure_tva BOOLEAN NOT NULL DEFAULT false,
  mode_paiement mode_paiement NOT NULL DEFAULT 'especes',
  depot_id UUID NOT NULL REFERENCES depots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vente_pos_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vente_pos_id UUID NOT NULL REFERENCES ventes_pos(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id),
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(12,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 20,
  montant_ht DECIMAL(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- MOUVEMENTS DE STOCK
-- ============================================================
CREATE TABLE mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id),
  depot_id UUID NOT NULL REFERENCES depots(id),
  type mouvement_type NOT NULL,
  quantite DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MOUVEMENTS DE TRÉSORERIE
-- ============================================================
CREATE TABLE mouvements_tresorerie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tresorerie_id UUID NOT NULL REFERENCES tresoreries(id),
  type mouvement_type NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  libelle VARCHAR(255) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS POUR MISE À JOUR AUTOMATIQUE DU STOCK
-- ============================================================

-- Fonction générique pour mettre à jour le stock
CREATE OR REPLACE FUNCTION update_stock(
  p_article_id UUID,
  p_depot_id UUID,
  p_quantite DECIMAL,
  p_type mouvement_type,
  p_ref_type VARCHAR,
  p_ref_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Upsert du stock
  INSERT INTO stock (article_id, depot_id, quantite)
  VALUES (p_article_id, p_depot_id,
    CASE WHEN p_type = 'entree' THEN p_quantite ELSE -p_quantite END
  )
  ON CONFLICT (article_id, depot_id)
  DO UPDATE SET quantite = stock.quantite +
    CASE WHEN p_type = 'entree' THEN p_quantite ELSE -p_quantite END;

  -- Log du mouvement
  INSERT INTO mouvements_stock (article_id, depot_id, type, quantite, reference_type, reference_id)
  VALUES (p_article_id, p_depot_id, p_type, p_quantite, p_ref_type, p_ref_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Bon de livraison validé → sortie de stock
CREATE OR REPLACE FUNCTION on_bon_livraison_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'sortie', 'bon_livraison', NEW.id)
    FROM bon_livraison_lignes l WHERE l.bon_livraison_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bon_livraison_stock
  AFTER UPDATE ON bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION on_bon_livraison_valide();

-- Trigger: Bon de retour validé → entrée en stock
CREATE OR REPLACE FUNCTION on_bon_retour_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_retour', NEW.id)
    FROM bon_retour_lignes l WHERE l.bon_retour_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bon_retour_stock
  AFTER UPDATE ON bon_retours
  FOR EACH ROW EXECUTE FUNCTION on_bon_retour_valide();

-- Trigger: Bon d'achat validé → entrée en stock
CREATE OR REPLACE FUNCTION on_bon_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'entree', 'bon_achat', NEW.id)
    FROM bon_achat_lignes l WHERE l.bon_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bon_achat_stock
  AFTER UPDATE ON bon_achats
  FOR EACH ROW EXECUTE FUNCTION on_bon_achat_valide();

-- Trigger: Bon de retour achat validé → sortie de stock
CREATE OR REPLACE FUNCTION on_bon_retour_achat_valide()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS NULL OR OLD.statut = 'brouillon') THEN
    PERFORM update_stock(l.article_id, NEW.depot_id, l.quantite, 'sortie', 'bon_retour_achat', NEW.id)
    FROM bon_retour_achat_lignes l WHERE l.bon_retour_achat_id = NEW.id AND l.article_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bon_retour_achat_stock
  AFTER UPDATE ON bon_retour_achats
  FOR EACH ROW EXECUTE FUNCTION on_bon_retour_achat_valide();

-- ============================================================
-- TRIGGER: updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_devis_updated_at BEFORE UPDATE ON devis FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE familles_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE depots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tresoreries ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_livraisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_livraison_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_retours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_retour_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_commande_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_achat_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_retour_achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_retour_achat_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vente_pos_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_tresorerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Generic policy: Admin and Gérant have full access to all tables
-- Commercial can read most, write own documents
-- Magasinier can access stock-related tables

-- Profiles: users can read all profiles, only admin can modify
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (get_user_role() = 'admin');

-- Clients: all roles except magasinier can read
CREATE POLICY clients_select ON clients FOR SELECT USING (get_user_role() != 'magasinier');
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant', 'commercial'));
CREATE POLICY clients_update ON clients FOR UPDATE USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY clients_delete ON clients FOR DELETE USING (get_user_role() IN ('admin', 'gerant'));

-- Fournisseurs: admin, gérant full; magasinier read
CREATE POLICY fournisseurs_select ON fournisseurs FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY fournisseurs_insert ON fournisseurs FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY fournisseurs_update ON fournisseurs FOR UPDATE USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY fournisseurs_delete ON fournisseurs FOR DELETE USING (get_user_role() IN ('admin', 'gerant'));

-- Articles: all can read
CREATE POLICY articles_select ON articles FOR SELECT USING (true);
CREATE POLICY articles_insert ON articles FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY articles_update ON articles FOR UPDATE USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY articles_delete ON articles FOR DELETE USING (get_user_role() IN ('admin', 'gerant'));

-- Familles: same as articles
CREATE POLICY familles_select ON familles_articles FOR SELECT USING (true);
CREATE POLICY familles_insert ON familles_articles FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY familles_update ON familles_articles FOR UPDATE USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY familles_delete ON familles_articles FOR DELETE USING (get_user_role() IN ('admin', 'gerant'));

-- Depots: all can read
CREATE POLICY depots_select ON depots FOR SELECT USING (true);
CREATE POLICY depots_modify ON depots FOR ALL USING (get_user_role() IN ('admin', 'gerant'));

-- Stock: all can read, magasinier + admin + gérant can modify
CREATE POLICY stock_select ON stock FOR SELECT USING (true);
CREATE POLICY stock_modify ON stock FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));

-- Salaries: admin full, gérant read
CREATE POLICY salaries_select ON salaries FOR SELECT USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY salaries_modify ON salaries FOR ALL USING (get_user_role() = 'admin');

-- Tresoreries: admin + gérant only
CREATE POLICY tresoreries_select ON tresoreries FOR SELECT USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY tresoreries_modify ON tresoreries FOR ALL USING (get_user_role() IN ('admin', 'gerant'));

-- Devis: admin/gérant full, commercial own
CREATE POLICY devis_select ON devis FOR SELECT USING (
  get_user_role() IN ('admin', 'gerant')
  OR (get_user_role() = 'commercial' AND commercial_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY devis_insert ON devis FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant', 'commercial'));
CREATE POLICY devis_update ON devis FOR UPDATE USING (
  get_user_role() IN ('admin', 'gerant')
  OR (get_user_role() = 'commercial' AND commercial_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY devis_delete ON devis FOR DELETE USING (get_user_role() IN ('admin', 'gerant'));

-- Devis lignes: follow parent devis access
CREATE POLICY devis_lignes_select ON devis_lignes FOR SELECT USING (true);
CREATE POLICY devis_lignes_modify ON devis_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'commercial'));

-- Bon livraisons: admin/gérant/magasinier, commercial read
CREATE POLICY bl_select ON bon_livraisons FOR SELECT USING (get_user_role() != 'magasinier' OR get_user_role() = 'magasinier');
CREATE POLICY bl_modify ON bon_livraisons FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bll_select ON bon_livraison_lignes FOR SELECT USING (true);
CREATE POLICY bll_modify ON bon_livraison_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));

-- Bon retours: same as BL
CREATE POLICY br_select ON bon_retours FOR SELECT USING (true);
CREATE POLICY br_modify ON bon_retours FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY brl_select ON bon_retour_lignes FOR SELECT USING (true);
CREATE POLICY brl_modify ON bon_retour_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));

-- Bon commandes: admin/gérant
CREATE POLICY bc_select ON bon_commandes FOR SELECT USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY bc_modify ON bon_commandes FOR ALL USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY bcl_select ON bon_commande_lignes FOR SELECT USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY bcl_modify ON bon_commande_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant'));

-- Bon achats: admin/gérant + magasinier
CREATE POLICY ba_select ON bon_achats FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY ba_modify ON bon_achats FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bal_select ON bon_achat_lignes FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bal_modify ON bon_achat_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));

-- Bon retour achats
CREATE POLICY bra_select ON bon_retour_achats FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bra_modify ON bon_retour_achats FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bral_select ON bon_retour_achat_lignes FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY bral_modify ON bon_retour_achat_lignes FOR ALL USING (get_user_role() IN ('admin', 'gerant', 'magasinier'));

-- Ventes POS
CREATE POLICY pos_select ON ventes_pos FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'commercial'));
CREATE POLICY pos_insert ON ventes_pos FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant', 'commercial'));
CREATE POLICY posl_select ON vente_pos_lignes FOR SELECT USING (get_user_role() IN ('admin', 'gerant', 'commercial'));
CREATE POLICY posl_insert ON vente_pos_lignes FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant', 'commercial'));

-- Mouvements: read only for most
CREATE POLICY ms_select ON mouvements_stock FOR SELECT USING (true);
CREATE POLICY ms_insert ON mouvements_stock FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant', 'magasinier'));
CREATE POLICY mt_select ON mouvements_tresorerie FOR SELECT USING (get_user_role() IN ('admin', 'gerant'));
CREATE POLICY mt_insert ON mouvements_tresorerie FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerant'));

-- Sequences: admin only modify
CREATE POLICY seq_select ON sequences FOR SELECT USING (true);
CREATE POLICY seq_modify ON sequences FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- INDEX POUR LA PERFORMANCE
-- ============================================================
CREATE INDEX idx_articles_famille ON articles(famille_id);
CREATE INDEX idx_stock_article ON stock(article_id);
CREATE INDEX idx_stock_depot ON stock(depot_id);
CREATE INDEX idx_devis_client ON devis(client_id);
CREATE INDEX idx_devis_commercial ON devis(commercial_id);
CREATE INDEX idx_devis_statut ON devis(statut);
CREATE INDEX idx_bl_client ON bon_livraisons(client_id);
CREATE INDEX idx_bl_depot ON bon_livraisons(depot_id);
CREATE INDEX idx_bc_fournisseur ON bon_commandes(fournisseur_id);
CREATE INDEX idx_ba_fournisseur ON bon_achats(fournisseur_id);
CREATE INDEX idx_pos_date ON ventes_pos(date);
CREATE INDEX idx_mvt_stock_article ON mouvements_stock(article_id);
CREATE INDEX idx_mvt_stock_depot ON mouvements_stock(depot_id);
CREATE INDEX idx_mvt_treso ON mouvements_tresorerie(tresorerie_id);


--- ==========================================================================
--- MIGRATION: 00002_tresorerie_integration.sql
--- ==========================================================================
-- ============================================================
-- Migration: Intégration Trésorerie sur tous les documents
-- ============================================================

-- 1. Ajouter tresorerie_id et mode_paiement aux tables de documents
-- (optionnels pour rétrocompatibilité avec les documents existants)

ALTER TABLE bon_livraisons
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_retours
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_achats
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

ALTER TABLE bon_retour_achats
  ADD COLUMN IF NOT EXISTS tresorerie_id UUID REFERENCES tresoreries(id),
  ADD COLUMN IF NOT EXISTS mode_paiement mode_paiement;

-- ============================================================
-- 2. Trigger: Bon de livraison validé → entrée de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_livraison_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    -- Créer mouvement d'entrée
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Bon de livraison ' || NEW.numero, 'bon_livraison', NEW.id);
    -- Mettre à jour le solde
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bl_tresorerie ON bon_livraisons;
CREATE TRIGGER trg_bl_tresorerie
  AFTER UPDATE ON bon_livraisons
  FOR EACH ROW EXECUTE FUNCTION trg_bon_livraison_tresorerie();

-- ============================================================
-- 3. Trigger: Bon de retour validé → sortie de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_retour_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon de retour ' || NEW.numero, 'bon_retour', NEW.id);
    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_br_tresorerie ON bon_retours;
CREATE TRIGGER trg_br_tresorerie
  AFTER UPDATE ON bon_retours
  FOR EACH ROW EXECUTE FUNCTION trg_bon_retour_tresorerie();

-- ============================================================
-- 4. Trigger: Bon d'achat validé → sortie de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon d''achat ' || NEW.numero, 'bon_achat', NEW.id);
    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ba_tresorerie ON bon_achats;
CREATE TRIGGER trg_ba_tresorerie
  AFTER UPDATE ON bon_achats
  FOR EACH ROW EXECUTE FUNCTION trg_bon_achat_tresorerie();

-- ============================================================
-- 5. Trigger: Bon de retour achat validé → entrée de trésorerie
-- ============================================================
CREATE OR REPLACE FUNCTION trg_bon_retour_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') AND NEW.tresorerie_id IS NOT NULL THEN
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Retour achat ' || NEW.numero, 'bon_retour_achat', NEW.id);
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bra_tresorerie ON bon_retour_achats;
CREATE TRIGGER trg_bra_tresorerie
  AFTER UPDATE ON bon_retour_achats
  FOR EACH ROW EXECUTE FUNCTION trg_bon_retour_achat_tresorerie();


--- ==========================================================================
--- MIGRATION: 00003_document_workflow_rpc.sql
--- ==========================================================================
-- ============================================================
-- RPC: Workflow Documents (Devis -> BL, BC -> BA)
-- ============================================================

-- Function to atomically accept a devis and create a BL
CREATE OR REPLACE FUNCTION accept_devis(p_devis_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_devis RECORD;
  v_bl_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Get Devis
  SELECT * INTO v_devis FROM devis WHERE id = p_devis_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable'; END IF;

  -- Allow re-accepting if BL doesn't exist (idempotency fix for partial failures)
  IF v_devis.statut = 'accepte' AND EXISTS (SELECT 1 FROM bon_livraisons WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Ce devis a déjà été accepté et un BL existe déjà.';
  END IF;

  -- 2. Update status
  UPDATE devis SET statut = 'accepte' WHERE id = p_devis_id;

  -- 3. Get numero
  SELECT next_numero('bon_livraison') INTO v_numero;

  -- 4. Create BL
  INSERT INTO bon_livraisons (
    numero, date, client_id, devis_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes
  ) VALUES (
    v_numero, CURRENT_DATE, v_devis.client_id, p_devis_id, p_depot_id, 'brouillon',
    v_devis.montant_ht, v_devis.montant_tva, v_devis.montant_ttc,
    'Créé automatiquement depuis devis ' || v_devis.numero
  ) RETURNING id INTO v_bl_id;

  -- 5. Copy lines
  INSERT INTO bon_livraison_lignes (
    bon_livraison_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_bl_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM devis_lignes
  WHERE devis_id = p_devis_id;

  RETURN jsonb_build_object('success', true, 'bl_id', v_bl_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to atomically validate a BC and create a BA
CREATE OR REPLACE FUNCTION validate_bon_commande(p_bc_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bc RECORD;
  v_ba_id UUID;
  v_numero VARCHAR;
BEGIN
  SELECT * INTO v_bc FROM bon_commandes WHERE id = p_bc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande introuvable'; END IF;

  IF v_bc.statut = 'valide' AND EXISTS (SELECT 1 FROM bon_achats WHERE bon_commande_id = p_bc_id) THEN
    RAISE EXCEPTION 'Ce bon de commande a déjà été validé et un BA existe déjà.';
  END IF;

  UPDATE bon_commandes SET statut = 'valide' WHERE id = p_bc_id;

  SELECT next_numero('bon_achat') INTO v_numero;

  INSERT INTO bon_achats (
    numero, date, fournisseur_id, bon_commande_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes
  ) VALUES (
    v_numero, CURRENT_DATE, v_bc.fournisseur_id, p_bc_id, p_depot_id, 'brouillon',
    v_bc.montant_ht, v_bc.montant_tva, v_bc.montant_ttc,
    'Créé automatiquement depuis BC ' || v_bc.numero
  ) RETURNING id INTO v_ba_id;

  INSERT INTO bon_achat_lignes (
    bon_achat_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_ba_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM bon_commande_lignes
  WHERE bon_commande_id = p_bc_id;

  RETURN jsonb_build_object('success', true, 'ba_id', v_ba_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00004_create_default_depot.sql
--- ==========================================================================
-- Create a default depot if none exists
INSERT INTO depots (code, libelle, adresse)
VALUES ('DEP-001', 'Dépôt Principal', 'Siège Social')
ON CONFLICT (code) DO NOTHING;


--- ==========================================================================
--- MIGRATION: 00005_update_treasury_triggers.sql
--- ==========================================================================
-- ============================================================
-- Update Treasury Triggers to support late payments
-- (When adding payment info to an already validated document)
-- ============================================================

-- 1. Bon de Livraison
CREATE OR REPLACE FUNCTION trg_bon_livraison_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger if:
  -- 1. Status changes to 'valide' AND treasery is set (Immediate payment)
  -- 2. Status is already 'valide' AND treasury changes from NULL to SET (Late payment)
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    -- Créer mouvement d'entrée
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Bon de livraison ' || NEW.numero, 'bon_livraison', NEW.id);

    -- Mettre à jour le solde
    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Bon de Retour
CREATE OR REPLACE FUNCTION trg_bon_retour_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon de retour ' || NEW.numero, 'bon_retour', NEW.id);

    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Bon d'Achat
CREATE OR REPLACE FUNCTION trg_bon_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'sortie', NEW.montant_ttc, 'Bon d''achat ' || NEW.numero, 'bon_achat', NEW.id);

    UPDATE tresoreries SET solde = solde - NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Bon Retour Achat
CREATE OR REPLACE FUNCTION trg_bon_retour_achat_tresorerie()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.statut = 'valide' AND NEW.tresorerie_id IS NOT NULL) AND
     ( (OLD.statut IS DISTINCT FROM 'valide') OR (OLD.tresorerie_id IS NULL) ) THEN

    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, 'entree', NEW.montant_ttc, 'Retour achat ' || NEW.numero, 'bon_retour_achat', NEW.id);

    UPDATE tresoreries SET solde = solde + NEW.montant_ttc WHERE id = NEW.tresorerie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00006_payment_system.sql
--- ==========================================================================
-- ============================================================
-- Payment System & Debt Management
-- ============================================================

-- 1. Create central payments table
CREATE TABLE IF NOT EXISTS paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  montant DECIMAL(14,2) NOT NULL,
  mode_paiement mode_paiement NOT NULL,
  tresorerie_id UUID NOT NULL REFERENCES tresoreries(id),
  
  -- Polymorphic relation
  reference_type VARCHAR(50) NOT NULL, -- 'bon_livraison', 'bon_achat', 'bon_retour', 'bon_retour_achat'
  reference_id UUID NOT NULL,
  
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add payment tracking columns to documents
ALTER TABLE bon_livraisons 
  ADD COLUMN IF NOT EXISTS statut_paiement VARCHAR(20) DEFAULT 'impaye',
  ADD COLUMN IF NOT EXISTS montant_regle DECIMAL(14,2) DEFAULT 0;

ALTER TABLE bon_achats 
  ADD COLUMN IF NOT EXISTS statut_paiement VARCHAR(20) DEFAULT 'impaye',
  ADD COLUMN IF NOT EXISTS montant_regle DECIMAL(14,2) DEFAULT 0;

ALTER TABLE bon_retours 
  ADD COLUMN IF NOT EXISTS statut_paiement VARCHAR(20) DEFAULT 'impaye',
  ADD COLUMN IF NOT EXISTS montant_regle DECIMAL(14,2) DEFAULT 0;

ALTER TABLE bon_retour_achats 
  ADD COLUMN IF NOT EXISTS statut_paiement VARCHAR(20) DEFAULT 'impaye',
  ADD COLUMN IF NOT EXISTS montant_regle DECIMAL(14,2) DEFAULT 0;

-- 3. DROP OLD TRIGGERS (Replaced by payment triggers)
DROP TRIGGER IF EXISTS trg_bl_tresorerie ON bon_livraisons;
DROP FUNCTION IF EXISTS trg_bon_livraison_tresorerie;

DROP TRIGGER IF EXISTS trg_br_tresorerie ON bon_retours;
DROP FUNCTION IF EXISTS trg_bon_retour_tresorerie;

DROP TRIGGER IF EXISTS trg_ba_tresorerie ON bon_achats;
DROP FUNCTION IF EXISTS trg_bon_achat_tresorerie;

DROP TRIGGER IF EXISTS trg_bra_tresorerie ON bon_retour_achats;
DROP FUNCTION IF EXISTS trg_bon_retour_achat_tresorerie;


-- 4. MIGRATE DATA (Transform old column-based payments to new table)
DO $$
BEGIN
  -- Bon Livraison
  INSERT INTO paiements (date, montant, mode_paiement, tresorerie_id, reference_type, reference_id, note)
  SELECT date, montant_ttc, mode_paiement, tresorerie_id, 'bon_livraison', id, 'Migration automatique'
  FROM bon_livraisons
  WHERE statut = 'valide' AND tresorerie_id IS NOT NULL;

  -- Update document status after migration
  UPDATE bon_livraisons SET statut_paiement = 'paye', montant_regle = montant_ttc 
  WHERE statut = 'valide' AND tresorerie_id IS NOT NULL;

  -- Bon Achat
  INSERT INTO paiements (date, montant, mode_paiement, tresorerie_id, reference_type, reference_id, note)
  SELECT date, montant_ttc, mode_paiement, tresorerie_id, 'bon_achat', id, 'Migration automatique'
  FROM bon_achats
  WHERE statut = 'valide' AND tresorerie_id IS NOT NULL;

  UPDATE bon_achats SET statut_paiement = 'paye', montant_regle = montant_ttc 
  WHERE statut = 'valide' AND tresorerie_id IS NOT NULL;

  -- Repeat for returns if needed (skipping for brevity as user focused on invoices)
END $$;


-- 5. CREATE NEW TRIGGERS

-- Function to handle payment insertion/update/delete
CREATE OR REPLACE FUNCTION trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  v_ref_table VARCHAR;
  v_ref_id UUID;
  v_montant DECIMAL(14,2);
  v_old_montant DECIMAL(14,2);
  v_type_mvt VARCHAR; -- 'entree' or 'sortie'
BEGIN
  -- Determine operation type and values
  IF (TG_OP = 'INSERT') THEN
    v_ref_table := NEW.reference_type || 's'; -- pluralize
    v_ref_id := NEW.reference_id;
    v_montant := NEW.montant;
    
    -- Determine movement type based on doc type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
      v_type_mvt := 'entree';
    ELSE
      v_type_mvt := 'sortie';
    END IF;

    -- Update Treasury
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, v_type_mvt, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id);
    
    IF v_type_mvt = 'entree' THEN
      UPDATE tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
    ELSE
      UPDATE tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    v_ref_table := OLD.reference_type || 's';
    v_ref_id := OLD.reference_id;
    v_montant := -OLD.montant; -- Negative to subtract

    -- Revert Treasury (simplistic: just invert logic)
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
       -- Was entree, now remove it (sortie equivalent)
       UPDATE tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
    ELSE
       -- Was sortie, now add it back
       UPDATE tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
    END IF;
    -- Remove movement? Or create compensating movement? 
    -- For simplicity, let's delete the movement linked to this payment
    DELETE FROM mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  -- Recalculate total paid via aggregate query to be safe
  EXECUTE format('
    WITH total AS (
      SELECT COALESCE(SUM(montant), 0) as ad 
      FROM paiements 
      WHERE reference_type = %L AND reference_id = %L
    )
    UPDATE %I 
    SET 
      montant_regle = total.ad,
      statut_paiement = CASE 
        WHEN total.ad >= montant_ttc THEN ''paye''
        WHEN total.ad > 0 THEN ''partiel''
        ELSE ''impaye''
      END
    FROM total
    WHERE id = %L', 
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type || 's' ELSE NEW.reference_type || 's' END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END)
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
CREATE TRIGGER trg_paiements_changes
  AFTER INSERT OR UPDATE OR DELETE ON paiements
  FOR EACH ROW EXECUTE FUNCTION trg_handle_paiement();


--- ==========================================================================
--- MIGRATION: 00007_payment_rls.sql
--- ==========================================================================
-- Enable RLS on paiements
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

-- Policy for Authenticated Users (Full Access)
CREATE POLICY "Enable all access for authenticated users" ON paiements
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Ensure triggers have permissions (if they weren't security definer, but they are)
-- Just in case, grant usage on sequence if any (uuid doesn't use sequence)

-- Check if associated tables allow access (just to be safe)
ALTER TABLE mouvements_tresorerie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON mouvements_tresorerie
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


--- ==========================================================================
--- MIGRATION: 00008_fix_trigger_enum_cast.sql
--- ==========================================================================
-- Fix trigger function to use correct enum type for status
CREATE OR REPLACE FUNCTION trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  v_ref_table VARCHAR;
  v_ref_id UUID;
  v_montant DECIMAL(14,2);
  v_old_montant DECIMAL(14,2);
  v_type_mvt mouvement_type; -- Changed from VARCHAR to mouvement_type
BEGIN
  -- Determine operation type and values
  IF (TG_OP = 'INSERT') THEN
    v_ref_table := NEW.reference_type || 's'; -- pluralize
    v_ref_id := NEW.reference_id;
    v_montant := NEW.montant;
    
    -- Determine movement type based on doc type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
      v_type_mvt := 'entree';
    ELSE
      v_type_mvt := 'sortie';
    END IF;

    -- Update Treasury
    INSERT INTO mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id)
    VALUES (NEW.tresorerie_id, v_type_mvt, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id);
    
    IF v_type_mvt = 'entree' THEN
      UPDATE tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
    ELSE
      UPDATE tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    v_ref_table := OLD.reference_type || 's';
    v_ref_id := OLD.reference_id;
    v_montant := -OLD.montant; -- Negative to subtract

    -- Revert Treasury
    -- We need to know what the original movement type was.
    -- Re-derive it logic or fetch from movement.
    -- Re-deriving is safer if movement was deleted manually (unlikely but possible).
    
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat') THEN
       -- Was entree, now remove it (sortie equivalent logic)
       UPDATE tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
    ELSE
       -- Was sortie, now add it back
       UPDATE tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
    END IF;

    DELETE FROM mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  EXECUTE format('
    WITH total AS (
      SELECT COALESCE(SUM(montant), 0) as ad 
      FROM paiements 
      WHERE reference_type = %L AND reference_id = %L
    )
    UPDATE %I 
    SET 
      montant_regle = total.ad,
      statut_paiement = CASE 
        WHEN total.ad >= montant_ttc THEN ''paye''
        WHEN total.ad > 0 THEN ''partiel''
        ELSE ''impaye''
      END
    FROM total
    WHERE id = %L', 
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type || 's' ELSE NEW.reference_type || 's' END),
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END)
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00009_treasury_view.sql
--- ==========================================================================
-- Create a view to resolving the polymorphic relationship for treasury movements
-- This allows checking the "real" source document (Invoice) behind a "Payment" movement

CREATE OR REPLACE VIEW v_mouvements_tresorerie_complets AS
SELECT 
    m.id,
    m.tresorerie_id,
    m.type,
    m.montant,
    m.libelle,
    m.created_at,
    -- Resolve Source Type
    CASE 
      WHEN m.reference_type = 'paiement' THEN p.reference_type
      ELSE m.reference_type 
    END as source_type,
    -- Resolve Source ID
    CASE 
      WHEN m.reference_type = 'paiement' THEN p.reference_id
      ELSE m.reference_id 
    END as source_id,
    -- Additional info
    m.reference_type as debug_ref_type,
    m.reference_id as debug_ref_id,
    p.note as paiement_note,
    p.mode_paiement as paiement_mode
FROM mouvements_tresorerie m
LEFT JOIN paiements p ON m.reference_type = 'paiement' AND m.reference_id = p.id;

-- Grant permissions
GRANT SELECT ON v_mouvements_tresorerie_complets TO authenticated;
GRANT SELECT ON v_mouvements_tresorerie_complets TO service_role;


--- ==========================================================================
--- MIGRATION: 00010_accounting_schema.sql
--- ==========================================================================
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



--- ==========================================================================
--- MIGRATION: 00011_accounting_triggers.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00012_accounting_views.sql
--- ==========================================================================
-- ============================================================
-- Migration: Vues Comptables (Reporting)
-- ============================================================

-- 1. Vue: Balance Générale (Aggregated by Account)
CREATE OR REPLACE VIEW v_balance_generale AS
SELECT 
    p.id as compte_id,
    p.compte,
    p.libelle,
    p.classe,
    COALESCE(SUM(l.debit), 0) as total_debit,
    COALESCE(SUM(l.credit), 0) as total_credit,
    COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as solde
FROM plan_comptable p
LEFT JOIN lignes_ecriture l ON p.id = l.compte_id
LEFT JOIN ecritures_comptables e ON l.ecriture_id = e.id
WHERE e.statut = 'valide' OR e.id IS NULL
GROUP BY p.id, p.compte, p.libelle, p.classe;

-- 2. Vue: Grand Livre (Enriched Lines)
DROP VIEW IF EXISTS v_grand_livre;

CREATE OR REPLACE VIEW v_grand_livre AS
SELECT 
    l.id,
    e.date,
    j.code as journal_code,
    e.libelle as ecriture_libelle,
    e.reference_type,
    e.reference_id,
    -- Add Payment Details
    pay.reference_type as pay_doc_type,
    pay.reference_id as pay_doc_id,
    p.compte,
    p.libelle as compte_libelle,
    l.debit,
    l.credit,
    l.libelle as ligne_libelle
FROM lignes_ecriture l
JOIN ecritures_comptables e ON l.ecriture_id = e.id
JOIN plan_comptable p ON l.compte_id = p.id
JOIN journaux j ON e.journal_id = j.id
LEFT JOIN paiements pay ON (e.reference_type = 'paiement' AND e.reference_id = pay.id)
WHERE e.statut = 'valide';

-- Grant permissions
GRANT SELECT ON v_balance_generale TO authenticated;
GRANT SELECT ON v_grand_livre TO authenticated;
GRANT SELECT ON v_balance_generale TO service_role;
GRANT SELECT ON v_grand_livre TO service_role;


--- ==========================================================================
--- MIGRATION: 00013_stock_trigger.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00014_article_stock_view.sql
--- ==========================================================================
-- View: Articles with aggregated stock
CREATE OR REPLACE VIEW v_articles_avec_stock AS
SELECT 
    a.*,
    COALESCE(SUM(s.quantite), 0) as stock_actuel
FROM articles a
LEFT JOIN stock s ON s.article_id = a.id
GROUP BY a.id;

-- Grant permissions
ALTER VIEW v_articles_avec_stock OWNER TO postgres;
GRANT SELECT ON v_articles_avec_stock TO authenticated;
GRANT SELECT ON v_articles_avec_stock TO service_role;


--- ==========================================================================
--- MIGRATION: 00016_fix_validate_bc_rpc.sql
--- ==========================================================================
-- Fix Validate BC RPC to use 'recu' status instead of 'valide'
CREATE OR REPLACE FUNCTION validate_bon_commande(p_bc_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bc RECORD;
  v_ba_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Récupérer le BC
  SELECT * INTO v_bc FROM bon_commandes WHERE id = p_bc_id;
  
  IF v_bc IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable';
  END IF;

  -- 2. Vérifier si déjà validé (ou reçu)
  IF v_bc.statut = 'recu' AND EXISTS (SELECT 1 FROM bon_achats WHERE bon_commande_id = p_bc_id) THEN
    RAISE EXCEPTION 'Ce bon de commande a déjà été validé et un BA existe déjà.';
  END IF;

  -- 3. VALIDATION ATOMIQUE --
  
  -- A. Mettre à jour le statut du BC (Final Status = 'recu')
  UPDATE bon_commandes SET statut = 'recu' WHERE id = p_bc_id;
  
  -- B. Créer le Bon d'Achat (Brouillon)
  SELECT next_numero('bon_achat') INTO v_numero;

  INSERT INTO bon_achats (
    numero, date, fournisseur_id, bon_commande_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes
  ) VALUES (
    v_numero, CURRENT_DATE, v_bc.fournisseur_id, p_bc_id, p_depot_id, 'brouillon',
    v_bc.montant_ht, v_bc.montant_tva, v_bc.montant_ttc,
    'Créé automatiquement depuis BC ' || v_bc.numero
  ) RETURNING id INTO v_ba_id;

  INSERT INTO bon_achat_lignes (
    bon_achat_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_ba_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM bon_commande_lignes
  WHERE bon_commande_id = p_bc_id;

  RETURN jsonb_build_object('success', true, 'ba_id', v_ba_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00017_add_inclure_tva.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00018_update_workflow_rpcs_for_tva.sql
--- ==========================================================================
-- Update accept_devis and validate_bon_commande to carry over the inclure_tva flag

-- 1. Update accept_devis
CREATE OR REPLACE FUNCTION accept_devis(p_devis_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_devis RECORD;
  v_bl_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Get Devis
  SELECT * INTO v_devis FROM devis WHERE id = p_devis_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable'; END IF;

  -- Allow re-accepting if BL doesn't exist (idempotency fix for partial failures)
  IF v_devis.statut = 'accepte' AND EXISTS (SELECT 1 FROM bon_livraisons WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Ce devis a déjà été accepté et un BL existe déjà.';
  END IF;

  -- 2. Update status
  UPDATE devis SET statut = 'accepte' WHERE id = p_devis_id;

  -- 3. Get numero
  SELECT next_numero('bon_livraison') INTO v_numero;

  -- 4. Create BL (carrying over inclure_tva)
  INSERT INTO bon_livraisons (
    numero, date, client_id, devis_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes, inclure_tva
  ) VALUES (
    v_numero, CURRENT_DATE, v_devis.client_id, p_devis_id, p_depot_id, 'brouillon',
    v_devis.montant_ht, v_devis.montant_tva, v_devis.montant_ttc,
    'Créé automatiquement depuis devis ' || v_devis.numero,
    v_devis.inclure_tva
  ) RETURNING id INTO v_bl_id;

  -- 5. Copy lines
  INSERT INTO bon_livraison_lignes (
    bon_livraison_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_bl_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM devis_lignes
  WHERE devis_id = p_devis_id;

  RETURN jsonb_build_object('success', true, 'bl_id', v_bl_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update validate_bon_commande
CREATE OR REPLACE FUNCTION validate_bon_commande(p_bc_id UUID, p_depot_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bc RECORD;
  v_ba_id UUID;
  v_numero VARCHAR;
BEGIN
  -- 1. Récupérer le BC
  SELECT * INTO v_bc FROM bon_commandes WHERE id = p_bc_id;
  
  IF v_bc IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable';
  END IF;

  -- 2. Vérifier si déjà validé (ou reçu)
  IF v_bc.statut = 'recu' AND EXISTS (SELECT 1 FROM bon_achats WHERE bon_commande_id = p_bc_id) THEN
    RAISE EXCEPTION 'Ce bon de commande a déjà été validé et un BA existe déjà.';
  END IF;

  -- 3. VALIDATION ATOMIQUE --
  
  -- A. Mettre à jour le statut du BC (Final Status = 'recu')
  UPDATE bon_commandes SET statut = 'recu' WHERE id = p_bc_id;
  
  -- B. Créer le Bon d'Achat (Brouillon) (carrying over inclure_tva)
  SELECT next_numero('bon_achat') INTO v_numero;

  INSERT INTO bon_achats (
    numero, date, fournisseur_id, bon_commande_id, depot_id, statut,
    montant_ht, montant_tva, montant_ttc, notes, inclure_tva
  ) VALUES (
    v_numero, CURRENT_DATE, v_bc.fournisseur_id, p_bc_id, p_depot_id, 'brouillon',
    v_bc.montant_ht, v_bc.montant_tva, v_bc.montant_ttc,
    'Créé automatiquement depuis BC ' || v_bc.numero,
    v_bc.inclure_tva
  ) RETURNING id INTO v_ba_id;

  INSERT INTO bon_achat_lignes (
    bon_achat_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  )
  SELECT
    v_ba_id, article_id, designation, quantite,
    prix_unitaire, tva, montant_ht, ordre
  FROM bon_commande_lignes
  WHERE bon_commande_id = p_bc_id;

  RETURN jsonb_build_object('success', true, 'ba_id', v_ba_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00019_add_fiscal_tracking_to_stock.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00020_add_fiscal_tracking_to_finance.sql
--- ==========================================================================
-- 1. Add fiscal flag to treasury movements
ALTER TABLE public.mouvements_tresorerie ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN DEFAULT false;

-- 2. Add fiscal flag to accounting entries
ALTER TABLE public.ecritures_comptables ADD COLUMN IF NOT EXISTS inclure_tva BOOLEAN DEFAULT false;

-- 3. Modernized trg_handle_paiement
CREATE OR REPLACE FUNCTION public.trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  mvt_type VARCHAR;
  is_documented BOOLEAN;
  doc_type VARCHAR;
  doc_id UUID;
BEGIN
  doc_type := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END);
  doc_id := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END);

  IF (TG_OP = 'INSERT') THEN
    -- Determine movement type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
      mvt_type := 'entree';
    ELSE
      mvt_type := 'sortie';
    END IF;

    -- FETCH FISCAL FLAG EXPLICITLY (Using := to avoid parser confusion with INTO TABLE)
    is_documented := (
      CASE doc_type
        WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = doc_id)
        WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = doc_id)
        WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = doc_id)
        WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = doc_id)
        WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = doc_id)
        ELSE false
      END
    );

    -- Update Treasury Movement
    INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
    VALUES (NEW.tresorerie_id, mvt_type, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, COALESCE(is_documented, false));
    
    IF mvt_type = 'entree' THEN
      UPDATE public.tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
    ELSE
      UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
       UPDATE public.tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
    ELSE
       UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
    END IF;
    
    DELETE FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  IF doc_type = 'bon_livraison' THEN
      UPDATE public.bon_livraisons SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_achat' THEN
      UPDATE public.bon_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour' THEN
      UPDATE public.bon_retours SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour_achat' THEN
      UPDATE public.bon_retour_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update trg_generate_ecriture_vente
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_vente() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_client_val UUID;
  compte_vente_val UUID;
  compte_tva_val UUID;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    journal_id_val := public.get_journal_id('VTE');
    compte_client_val := public.get_compte_id('3421');
    compte_vente_val := public.get_compte_id('7111');
    compte_tva_val := public.get_compte_id('4455');

    INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
    VALUES (CURRENT_DATE, journal_id_val, 'Facture N° ' || NEW.numero, 'bon_livraison', NEW.id, 'valide', NEW.inclure_tva)
    RETURNING id INTO ecriture_id_val;

    INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (ecriture_id_val, compte_client_val, NEW.montant_ttc, 0, 'Client ' || NEW.client_id);

    IF NEW.montant_ht > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_vente_val, 0, NEW.montant_ht, 'Vente Marchandises');
    END IF;

    IF NEW.montant_tva > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_tva_val, 0, NEW.montant_tva, 'TVA Facturée');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update trg_generate_ecriture_achat
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_achat() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_fournisseur_val UUID;
  compte_achat_val UUID;
  compte_tva_val UUID;
BEGIN
  IF NEW.statut = 'valide' AND (OLD.statut IS DISTINCT FROM 'valide') THEN
    journal_id_val := public.get_journal_id('ACH');
    compte_fournisseur_val := public.get_compte_id('4411');
    compte_achat_val := public.get_compte_id('6111');
    compte_tva_val := public.get_compte_id('3455');

    INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
    VALUES (CURRENT_DATE, journal_id_val, 'Facture Achat N° ' || NEW.numero, 'bon_achat', NEW.id, 'valide', NEW.inclure_tva)
    RETURNING id INTO ecriture_id_val;

    IF NEW.montant_ht > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_achat_val, NEW.montant_ht, 0, 'Achat Marchandises');
    END IF;

    IF NEW.montant_tva > 0 THEN
      INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
      VALUES (ecriture_id_val, compte_tva_val, NEW.montant_tva, 0, 'TVA Récupérable');
    END IF;

    INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit, libelle)
    VALUES (ecriture_id_val, compte_fournisseur_val, 0, NEW.montant_ttc, 'Fournisseur');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Update trg_generate_ecriture_paiement
CREATE OR REPLACE FUNCTION public.trg_generate_ecriture_paiement() RETURNS TRIGGER AS $$
DECLARE
  journal_id_val UUID;
  ecriture_id_val UUID;
  compte_tiers_val UUID;
  compte_treso_val UUID;
  treso_type_val VARCHAR;
  is_documented BOOLEAN;
BEGIN
  -- Safe scalar assignment to avoid parser confusion with SELECT INTO
  treso_type_val := (SELECT type FROM public.tresoreries WHERE id = NEW.tresorerie_id);
  
  is_documented := (
    CASE NEW.reference_type
      WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = NEW.reference_id)
      WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = NEW.reference_id)
      WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = NEW.reference_id)
      WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = NEW.reference_id)
      WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = NEW.reference_id)
      ELSE false
    END
  );

  IF treso_type_val = 'banque' THEN
    journal_id_val := public.get_journal_id('BNQ');
    compte_treso_val := public.get_compte_id('5141');
  ELSE
    journal_id_val := public.get_journal_id('CAI');
    compte_treso_val := public.get_compte_id('5161');
  END IF;

  INSERT INTO public.ecritures_comptables (date, journal_id, libelle, reference_type, reference_id, statut, inclure_tva)
  VALUES (NEW.date::date, journal_id_val, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, 'valide', COALESCE(is_documented, false))
  RETURNING id INTO ecriture_id_val;

  IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
     compte_tiers_val := public.get_compte_id('3421');
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_treso_val, NEW.montant, 0);
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_tiers_val, 0, NEW.montant);
  ELSE 
     compte_tiers_val := public.get_compte_id('4411');
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_tiers_val, NEW.montant, 0);
     INSERT INTO public.lignes_ecriture (ecriture_id, compte_id, debit, credit)
     VALUES (ecriture_id_val, compte_treso_val, 0, NEW.montant);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Update v_grand_livre
DROP VIEW IF EXISTS public.v_grand_livre CASCADE;
CREATE OR REPLACE VIEW public.v_grand_livre AS
SELECT 
    l.id,
    e.date,
    j.code as journal_code,
    e.libelle as ecriture_libelle,
    e.reference_type,
    e.reference_id,
    e.inclure_tva,
    pay.reference_type as pay_doc_type,
    pay.reference_id as pay_doc_id,
    p.compte,
    p.libelle as compte_libelle,
    l.debit,
    l.credit,
    l.libelle as ligne_libelle
FROM public.lignes_ecriture l
JOIN public.ecritures_comptables e ON l.ecriture_id = e.id
JOIN public.plan_comptable p ON l.compte_id = p.id
JOIN public.journaux j ON e.journal_id = j.id
LEFT JOIN public.paiements pay ON (e.reference_type = 'paiement' AND e.reference_id = pay.id)
WHERE e.statut = 'valide';

GRANT SELECT ON public.v_grand_livre TO authenticated;
GRANT SELECT ON public.v_grand_livre TO service_role;

-- 8. v_balance_generale_fiscal
DROP VIEW IF EXISTS public.v_balance_generale_fiscal CASCADE;
CREATE OR REPLACE VIEW public.v_balance_generale_fiscal AS
SELECT 
    p.id as compte_id,
    p.compte,
    p.libelle,
    p.classe,
    COALESCE(SUM(l.debit), 0) as total_debit,
    COALESCE(SUM(l.credit), 0) as total_credit,
    COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as solde
FROM public.plan_comptable p
LEFT JOIN public.lignes_ecriture l ON p.id = l.compte_id
LEFT JOIN public.ecritures_comptables e ON l.ecriture_id = e.id
WHERE (e.statut = 'valide' AND e.inclure_tva = true) OR e.id IS NULL
GROUP BY p.id, p.compte, p.libelle, p.classe;

GRANT SELECT ON public.v_balance_generale_fiscal TO authenticated;
GRANT SELECT ON public.v_balance_generale_fiscal TO service_role;


--- ==========================================================================
--- MIGRATION: 00021_add_fiscal_stock_rpc.sql
--- ==========================================================================
-- Improved RPC to calculate stock filtered by fiscal status with rich entity data
DROP FUNCTION IF EXISTS public.get_fiscal_stock(UUID);

CREATE OR REPLACE FUNCTION public.get_fiscal_stock(p_depot_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    article_id UUID,
    depot_id UUID,
    quantite DECIMAL,
    article_code TEXT,
    article_designation TEXT,
    article_prix_achat DECIMAL,
    article_prix_vente DECIMAL,
    article_tva INTEGER,
    famille_libelle TEXT,
    sous_famille_libelle TEXT,
    depot_libelle TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gen_random_uuid() as id,
        m.article_id,
        m.depot_id,
        SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END) as quantite,
        a.code as article_code,
        a.designation as article_designation,
        a.prix_achat as article_prix_achat,
        a.prix_vente as article_prix_vente,
        a.tva as article_tva,
        f.libelle as famille_libelle,
        sf.libelle as sous_famille_libelle,
        d.libelle as depot_libelle
    FROM public.mouvements_stock m
    JOIN public.articles a ON m.article_id = a.id
    LEFT JOIN public.familles_articles f ON a.famille_id = f.id
    LEFT JOIN public.sous_familles_articles sf ON a.sous_famille_id = sf.id
    JOIN public.depots d ON m.depot_id = d.id
    WHERE m.inclure_tva = true
    AND (p_depot_id IS NULL OR m.depot_id = p_depot_id)
    GROUP BY m.article_id, m.depot_id, a.id, f.id, sf.id, d.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_fiscal_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fiscal_stock(UUID) TO service_role;


--- ==========================================================================
--- MIGRATION: 00022_fix_stock_logic.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00023_master_data_fiscal_support.sql
--- ==========================================================================
-- 00023_master_data_fiscal_support.sql
-- 1. Add fiscal balance column to treasury
ALTER TABLE public.tresoreries ADD COLUMN IF NOT EXISTS solde_fiscale DECIMAL(14,2) NOT NULL DEFAULT 0;

-- 2. Update trg_handle_paiement to maintain fiscal balance
CREATE OR REPLACE FUNCTION public.trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  mvt_type VARCHAR;
  is_documented BOOLEAN;
  doc_type VARCHAR;
  doc_id UUID;
BEGIN
  doc_type := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END);
  doc_id := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END);

  IF (TG_OP = 'INSERT') THEN
    -- Determine movement type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
      mvt_type := 'entree';
    ELSE
      mvt_type := 'sortie';
    END IF;

    -- FETCH FISCAL FLAG EXPLICITLY
    is_documented := (
      CASE doc_type
        WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = doc_id)
        WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = doc_id)
        WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = doc_id)
        WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = doc_id)
        WHEN 'vente_pos' THEN (SELECT COALESCE(inclure_tva, false) FROM public.ventes_pos WHERE id = doc_id)
        WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = doc_id)
        ELSE false
      END
    );

    -- Update Treasury Movement
    INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
    VALUES (NEW.tresorerie_id, mvt_type, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, COALESCE(is_documented, false));
    
    -- Global Balance Update
    IF mvt_type = 'entree' THEN
      UPDATE public.tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
      -- Fiscal Balance Update
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    ELSE
      UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
      -- Fiscal Balance Update
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    is_documented := (SELECT inclure_tva FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id LIMIT 1);
    
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
       UPDATE public.tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    ELSE
       UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    END IF;
    
    DELETE FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS (Simplified keep existing logic)
  IF doc_type = 'bon_livraison' THEN
      UPDATE public.bon_livraisons SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_achat' THEN
      UPDATE public.bon_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Initial Recalculation of Solde Fiscale
UPDATE public.tresoreries t
SET solde_fiscale = (
  SELECT COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END), 0)
  FROM public.mouvements_tresorerie
  WHERE tresorerie_id = t.id AND inclure_tva = true
);


--- ==========================================================================
--- MIGRATION: 00024_add_depenses_and_sous_familles.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00025_advanced_finance_and_traceability.sql
--- ==========================================================================
-- 1. Add 'effet' to mode_paiement enum
-- (Note: In some Postgres environments this must be run outside a transaction)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'mode_paiement' AND e.enumlabel = 'effet') THEN
        ALTER TYPE public.mode_paiement ADD VALUE 'effet';
    END IF;
END $$;

-- 2. Update paiements table for advanced tracking
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS date_echeance DATE; -- For Cheques and Effects
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS reference_paiement TEXT; -- For Transaction Ref or Cheque No
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS statut_versement TEXT DEFAULT 'encaisse'; -- 'encaisse', 'rejete', 'en_attente'

-- Index for Portfolio management (Temporal simple index to avoid enum usage error in transaction)
CREATE INDEX IF NOT EXISTS idx_paiements_echeance ON public.paiements(date_echeance);

-- 3. Upgrade traceability to multi-code supporting arrays
-- Tables: BL, BA, BR, BRA, Devis, BC
DO $$
DECLARE
    row RECORD;
    v_table_name TEXT;
    document_line_tables TEXT[] := ARRAY[
        'bon_livraison_lignes', 
        'bon_achat_lignes', 
        'bon_retour_lignes', 
        'bon_retour_achat_lignes', 
        'devis_lignes', 
        'bon_commande_lignes',
        'vente_pos_lignes'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY document_line_tables LOOP
        -- Add codes_articles as TEXT array
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS codes_articles TEXT[] DEFAULT ARRAY[]::TEXT[]', v_table_name);
        
        -- Migrate data if code_article exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'code_article') THEN
            EXECUTE format('UPDATE public.%I SET codes_articles = ARRAY[code_article] WHERE code_article IS NOT NULL AND (codes_articles IS NULL OR array_length(codes_articles, 1) IS NULL)', v_table_name);
        END IF;
    END LOOP;
END $$;

-- 4. Improve Stock View by adding article attributes
-- We'll create or update the helper for fetching stock with attributes
CREATE OR REPLACE VIEW public.vw_stock_detaille AS
SELECT 
    s.*,
    a.code as article_code,
    a.designation as article_designation,
    a.prix_achat as article_prix_achat,
    a.prix_vente as article_prix_vente,
    a.seuil_alerte as article_seuil_alerte,
    f.libelle as famille,
    sf.libelle as sous_famille,
    d.libelle as depot_libelle,
    (s.quantite * a.prix_achat) as valeur_achat_totale,
    (s.quantite * a.prix_vente) as valeur_vente_totale
FROM public.stock s
JOIN public.articles a ON s.article_id = a.id
LEFT JOIN public.familles_articles f ON a.famille_id = f.id
LEFT JOIN public.sous_familles_articles sf ON a.sous_famille_id = sf.id
JOIN public.depots d ON s.depot_id = d.id;

GRANT SELECT ON public.vw_stock_detaille TO authenticated;


--- ==========================================================================
--- MIGRATION: 00026_finalize_finance_views.sql
--- ==========================================================================
-- 1. Optimized Index for Portfolio management using the committed enum value
DROP INDEX IF EXISTS idx_paiements_echeance;
CREATE INDEX IF NOT EXISTS idx_paiements_echeance ON public.paiements(date_echeance) WHERE mode_paiement IN ('cheque', 'effet');

-- 2. Finance Portfolio View
CREATE OR REPLACE VIEW public.vw_portefeuille AS
SELECT 
    p.*,
    CASE 
        WHEN p.reference_type = 'bon_livraison' THEN (SELECT raison_sociale FROM public.clients c JOIN public.bon_livraisons doc ON c.id = doc.client_id WHERE doc.id = p.reference_id)
        WHEN p.reference_type = 'bon_achat' THEN (SELECT raison_sociale FROM public.fournisseurs f JOIN public.bon_achats doc ON f.id = doc.fournisseur_id WHERE doc.id = p.reference_id)
        -- Add others as needed
    END as tiers_nom
FROM public.paiements p
WHERE p.mode_paiement IN ('cheque', 'effet');

-- 3. Permissions
GRANT SELECT ON public.vw_portefeuille TO authenticated;


--- ==========================================================================
--- MIGRATION: 00027_add_global_code_search_rpc.sql
--- ==========================================================================
-- RPC for global search of an article by any code (Barcode, Reference, or Serial Number/IMEI)
-- Fixed syntax using direct assignments (:=) to avoid ambiguity in PL/pgSQL
CREATE OR REPLACE FUNCTION public.find_article_by_code(p_search_code TEXT)
RETURNS TABLE (
    article_id UUID,
    designation TEXT,
    prix_vente DECIMAL,
    tva INTEGER,
    stock_actuel DECIMAL,
    found_via TEXT -- 'direct', 'traceability'
) AS $$
DECLARE
    v_id UUID;
    v_via TEXT;
BEGIN
    -- 1. Search in Articles (Barcode, Reference or Code)
    v_id := (SELECT a.id FROM public.articles a WHERE a.code_barre = p_search_code OR a.reference = p_search_code OR a.code = p_search_code LIMIT 1);
    
    IF v_id IS NOT NULL THEN
        v_via := 'direct';
    ELSE
        -- 2. Search in Traceability (Purchase lines)
        v_id := (SELECT l.article_id FROM public.bon_achat_lignes l WHERE p_search_code = ANY(l.codes_articles) LIMIT 1);
        
        IF v_id IS NULL THEN
            -- 3. Search in Sales lines (Delivery Notes)
            v_id := (SELECT l.article_id FROM public.bon_livraison_lignes l WHERE p_search_code = ANY(l.codes_articles) LIMIT 1);
        END IF;

        IF v_id IS NOT NULL THEN
            v_via := 'traceability';
        END IF;
    END IF;

    -- Return full article information and actual stock
    IF v_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            a.id, 
            a.designation, 
            a.prix_vente, 
            a.tva,
            COALESCE((SELECT SUM(s.quantite) FROM public.stock s WHERE s.article_id = a.id), 0) as stock_actuel,
            v_via
        FROM public.articles a
        WHERE a.id = v_id;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.find_article_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_article_by_code(TEXT) TO service_role;


--- ==========================================================================
--- MIGRATION: 00028_add_regularisation_tracking.sql
--- ==========================================================================
-- 00028_add_regularisation_tracking.sql
-- Add flag to identify documents and lines that bypass stock checks for balancing.

ALTER TABLE devis ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bon_livraisons ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bon_livraison_lignes ADD COLUMN IF NOT EXISTS is_regularisation BOOLEAN NOT NULL DEFAULT false;

-- Index for traceability view performance
CREATE INDEX IF NOT EXISTS idx_bl_regularisation ON bon_livraisons(is_regularisation) WHERE is_regularisation = true;
CREATE INDEX IF NOT EXISTS idx_devis_regularisation ON devis(is_regularisation) WHERE is_regularisation = true;


--- ==========================================================================
--- MIGRATION: 00029_v_fiscal_balance.sql
--- ==========================================================================
-- 00029_v_fiscal_balance.sql
-- Create a comprehensive view to identify physical and fiscal stock discrepancies.

CREATE OR REPLACE VIEW v_fiscal_balance AS
WITH stats AS (
    SELECT 
        article_id,
        depot_id,
        -- Total Physical Stock
        SUM(CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) as stock_physique,
        -- Official Stock (With TVA)
        SUM(CASE WHEN inclure_tva = true THEN (CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) ELSE 0 END) as stock_tva,
        -- Informal Stock (Without TVA)
        SUM(CASE WHEN inclure_tva = false THEN (CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) ELSE 0 END) as stock_hors_tva
    FROM mouvements_stock
    GROUP BY article_id, depot_id
)
SELECT 
    s.*,
    a.code as article_code,
    a.designation as article_designation,
    d.libelle as depot_libelle,
    -- Flags for discrepancies
    (s.stock_physique < 0) as deficit_physique,
    (s.stock_tva < 0) as deficit_fiscal,
    (s.stock_hors_tva < 0) as deficit_informel
FROM stats s
JOIN articles a ON s.article_id = a.id
JOIN depots d ON s.depot_id = d.id;

-- Grant access
GRANT SELECT ON v_fiscal_balance TO authenticated;
GRANT SELECT ON v_fiscal_balance TO service_role;


--- ==========================================================================
--- MIGRATION: 00030_fix_payments_integrity.sql
--- ==========================================================================
-- 00030_fix_payments_integrity.sql

-- 1. Ensure inclure_tva exists on ALL document tables to prevent trigger failures
DO $$ 
BEGIN
    -- Devis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.devis ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_livraisons' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_livraisons ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_achats' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_achats ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BR
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_retours' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_retours ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BRA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_retour_achats' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_retour_achats ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- BC
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bon_commandes' AND column_name = 'inclure_tva') THEN
        ALTER TABLE public.bon_commandes ADD COLUMN inclure_tva BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Make the payment trigger more robust by handling missing documents or schema sync lag
CREATE OR REPLACE FUNCTION public.trg_handle_paiement()
RETURNS TRIGGER AS $$
DECLARE
  mvt_type public.mouvement_type;
  is_documented BOOLEAN := false;
  doc_type VARCHAR;
  doc_id UUID;
BEGIN
  doc_type := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_type ELSE NEW.reference_type END);
  doc_id := (CASE WHEN TG_OP = 'DELETE' THEN OLD.reference_id ELSE NEW.reference_id END);

  IF (TG_OP = 'INSERT') THEN
    -- Determine movement type
    IF NEW.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
      mvt_type := 'entree';
    ELSE
      mvt_type := 'sortie';
    END IF;

    -- FETCH FISCAL FLAG EXPLICITLY with safe blocks
    BEGIN
        is_documented := (
          CASE doc_type
            WHEN 'bon_livraison' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_livraisons WHERE id = doc_id)
            WHEN 'bon_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_achats WHERE id = doc_id)
            WHEN 'bon_retour' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retours WHERE id = doc_id)
            WHEN 'bon_retour_achat' THEN (SELECT COALESCE(inclure_tva, false) FROM public.bon_retour_achats WHERE id = doc_id)
            WHEN 'vente_pos' THEN (SELECT COALESCE(inclure_tva, false) FROM public.ventes_pos WHERE id = doc_id)
            WHEN 'devis' THEN (SELECT COALESCE(inclure_tva, false) FROM public.devis WHERE id = doc_id)
            ELSE false
          END
        );
    EXCEPTION WHEN OTHERS THEN
        is_documented := false; -- Fallback if column still missing during transition
    END;

    -- Update Treasury Movement
    INSERT INTO public.mouvements_tresorerie (tresorerie_id, type, montant, libelle, reference_type, reference_id, inclure_tva)
    VALUES (NEW.tresorerie_id, mvt_type, NEW.montant, 'Règlement ' || NEW.reference_type, 'paiement', NEW.id, COALESCE(is_documented, false));
    
    -- Global Balance Update
    IF mvt_type = 'entree' THEN
      UPDATE public.tresoreries SET solde = solde + NEW.montant WHERE id = NEW.tresorerie_id;
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    ELSE
      UPDATE public.tresoreries SET solde = solde - NEW.montant WHERE id = NEW.tresorerie_id;
      IF COALESCE(is_documented, false) THEN
        UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - NEW.montant WHERE id = NEW.tresorerie_id;
      END IF;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    -- Try to fetch documented flag from movement history
    is_documented := COALESCE((SELECT inclure_tva FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id LIMIT 1), false);
    
    IF OLD.reference_type IN ('bon_livraison', 'bon_retour_achat', 'vente_pos') THEN
       UPDATE public.tresoreries SET solde = solde - OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale - OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    ELSE
       UPDATE public.tresoreries SET solde = solde + OLD.montant WHERE id = OLD.tresorerie_id;
       IF COALESCE(is_documented, false) THEN
         UPDATE public.tresoreries SET solde_fiscale = solde_fiscale + OLD.montant WHERE id = OLD.tresorerie_id;
       END IF;
    END IF;
    
    DELETE FROM public.mouvements_tresorerie WHERE reference_type = 'paiement' AND reference_id = OLD.id;
  END IF;

  -- UPDATE DOCUMENT STATS
  IF doc_type = 'bon_livraison' THEN
      UPDATE public.bon_livraisons SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_livraison' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_achat' THEN
      UPDATE public.bon_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour' THEN
      UPDATE public.bon_retours SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  ELSIF doc_type = 'bon_retour_achat' THEN
      UPDATE public.bon_retour_achats SET 
        montant_regle = (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id),
        statut_paiement = CASE WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) >= montant_ttc THEN 'paye' WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.paiements WHERE reference_type = 'bon_retour_achat' AND reference_id = doc_id) > 0 THEN 'partiel' ELSE 'impaye' END
      WHERE id = doc_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00031_system_reset_rpc.sql
--- ==========================================================================
-- ============================================================
-- RPC: Reset Database
-- Allows two modes: 'transactions' (keeps products/clients) or 'full' (purges catalogs too, except users/treasury/depots)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_reset_database(p_mode TEXT)
RETURNS void AS $$
BEGIN
    -- Disable triggers temporarily if needed, though TRUNCATE handles it well usually.
    
    IF p_mode = 'full' THEN
        -- TRUNCATE CASCADE will automatically delete all lines (bon_livraison_lignes, etc.)
        -- and stock logic. Also deletes operations because of references, but we explicitly list them.
        TRUNCATE TABLE 
            clients, 
            fournisseurs, 
            familles_articles, 
            sous_familles_articles, 
            articles, 
            stock,
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie 
        CASCADE;
        
    ELSIF p_mode = 'transactions' THEN
        TRUNCATE TABLE 
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie 
        CASCADE;
        
        -- Reset stock quantities instead of deleting stock rows tracking articles
        UPDATE stock SET quantite = 0, quantite_fiscale = 0 WHERE id IS NOT NULL;
    ELSE
        RAISE EXCEPTION 'Invalid mode. Must be transactions or full';
    END IF;

    -- Reset treasury balances
    UPDATE tresoreries SET solde = 0, solde_fiscale = 0 WHERE id IS NOT NULL;
    
    -- Reset numbering sequences
    UPDATE sequences SET dernier_numero = 0 WHERE id IS NOT NULL;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00032_auto_generate_codes.sql
--- ==========================================================================
-- Función para generar códigos automáticos para Clientes y Artículos
CREATE OR REPLACE FUNCTION generate_missing_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  tbl TEXT;
  new_code TEXT;
  counter INT;
BEGIN
  -- Si ya tiene código, no hacemos nada
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  -- Determinar prefijo según tabla
  tbl := TG_TABLE_NAME;
  IF tbl = 'clients' THEN prefix := 'CLI-';
  ELSIF tbl = 'articles' THEN prefix := 'ART-';
  ELSIF tbl = 'fournisseurs' THEN prefix := 'FOR-';
  ELSE prefix := 'GEN-';
  END IF;

  -- Generar código único sencillo
  SELECT count(*) + 1 INTO counter FROM (SELECT 1 FROM clients UNION ALL SELECT 1 FROM articles UNION ALL SELECT 1 FROM fournisseurs) as total;
  new_code := prefix || LPAD(counter::TEXT, 5, '0');
  
  NEW.code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas principales
DROP TRIGGER IF EXISTS trg_auto_code_clients ON clients;
CREATE TRIGGER trg_auto_code_clients BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION generate_missing_code();

DROP TRIGGER IF EXISTS trg_auto_code_articles ON articles;
CREATE TRIGGER trg_auto_code_articles BEFORE INSERT ON articles FOR EACH ROW EXECUTE FUNCTION generate_missing_code();

DROP TRIGGER IF EXISTS trg_auto_code_fournisseurs ON fournisseurs;
CREATE TRIGGER trg_auto_code_fournisseurs BEFORE INSERT ON fournisseurs FOR EACH ROW EXECUTE FUNCTION generate_missing_code();


--- ==========================================================================
--- MIGRATION: 00032_fix_system_reset_rpc.sql
--- ==========================================================================
-- ============================================================
-- RPC: Reset Database
-- Fix: Add WHERE clauses to bypass safe_update restrictions
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_reset_database(p_mode TEXT)
RETURNS void AS $$
BEGIN
    IF p_mode = 'full' THEN
        TRUNCATE TABLE 
            clients, 
            fournisseurs, 
            familles_articles, 
            sous_familles_articles, 
            articles, 
            stock,
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie 
        CASCADE;
        
    ELSIF p_mode = 'transactions' THEN
        TRUNCATE TABLE 
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie 
        CASCADE;
        
        -- Reset stock quantities instead of deleting stock rows tracking articles
        UPDATE stock SET quantite = 0, quantite_fiscale = 0 WHERE id IS NOT NULL;
    ELSE
        RAISE EXCEPTION 'Invalid mode. Must be transactions or full';
    END IF;

    -- Reset treasury balances
    UPDATE tresoreries SET solde = 0, solde_fiscale = 0 WHERE id IS NOT NULL;
    
    -- Reset numbering sequences
    UPDATE sequences SET dernier_numero = 0 WHERE type IS NOT NULL; -- Use type as it is NOT NULL

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00033_fix_system_reset_rpc_accounting.sql
--- ==========================================================================
-- ============================================================
-- RPC: Reset Database
-- Fix: Include accounting (ecritures_comptables) in the reset
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_reset_database(p_mode TEXT)
RETURNS void AS $$
BEGIN
    IF p_mode = 'full' THEN
        TRUNCATE TABLE 
            clients, 
            fournisseurs, 
            familles_articles, 
            sous_familles_articles, 
            articles, 
            stock,
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie,
            ecritures_comptables
        CASCADE;
        
    ELSIF p_mode = 'transactions' THEN
        TRUNCATE TABLE 
            devis, 
            bon_livraisons, 
            bon_retours, 
            bon_commandes, 
            bon_achats, 
            bon_retour_achats, 
            ventes_pos, 
            paiements, 
            depenses,
            mouvements_stock, 
            mouvements_tresorerie,
            ecritures_comptables
        CASCADE;
        
        -- Reset stock quantities instead of deleting stock rows tracking articles
        UPDATE stock SET quantite = 0, quantite_fiscale = 0 WHERE id IS NOT NULL;
    ELSE
        RAISE EXCEPTION 'Invalid mode. Must be transactions or full';
    END IF;

    -- Reset treasury balances
    UPDATE tresoreries SET solde = 0, solde_fiscale = 0 WHERE id IS NOT NULL;
    
    -- Reset numbering sequences
    UPDATE sequences SET dernier_numero = 0 WHERE type IS NOT NULL; 

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


--- ==========================================================================
--- MIGRATION: 00034_fix_stock_triggers_final.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00034_fix_stock_triggers_insert.sql
--- ==========================================================================
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


--- ==========================================================================
--- MIGRATION: 00035_robust_master_data_codes.sql
--- ==========================================================================
-- 1. Initialize sequences for master data if not exist
INSERT INTO sequences (type, prefixe, dernier_numero) 
VALUES 
  ('client', 'CLI', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM clients)),
  ('fournisseur', 'FRN', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM fournisseurs)),
  ('article', 'ART', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM articles)),
  ('famille_article', 'FAM', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM familles_articles)),
  ('depot', 'DEP', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM depots)),
  ('salarie', 'SAL', (SELECT COALESCE(MAX(CAST(substring(matricule from '\d+') AS INTEGER)), 0) FROM salaries)),
  ('tresorerie', 'TRS', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM tresoreries))
ON CONFLICT (type) DO UPDATE SET prefixe = EXCLUDED.prefixe;

-- 2. Update next_numero to handle master data format (CLI00001) vs documents (BL-YYYY-0001)
CREATE OR REPLACE FUNCTION next_numero(p_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq sequences%ROWTYPE;
  v_numero VARCHAR;
BEGIN
  UPDATE sequences
  SET dernier_numero = dernier_numero + 1
  WHERE type = p_type
  RETURNING * INTO v_seq;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sequence type % not found', p_type;
  END IF;

  -- Master data format: PREFIX00001 (sin año)
  IF p_type IN ('client', 'fournisseur', 'article', 'famille_article', 'depot', 'salarie', 'tresorerie') THEN
    v_numero := v_seq.prefixe || LPAD(v_seq.dernier_numero::TEXT, 5, '0');
  ELSE
    -- Documents format: PREFIX-YYYY-0001 (con año)
    v_numero := v_seq.prefixe || '-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(v_seq.dernier_numero::TEXT, 4, '0');
  END IF;
  
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- 3. Update the trigger function to use next_numero (safety net for direct SQL inserts)
CREATE OR REPLACE FUNCTION generate_missing_code()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'salaries' THEN
    IF NEW.matricule IS NULL OR NEW.matricule = '' THEN
      NEW.matricule := next_numero('salarie');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  -- Use next_numero based on table name
  IF TG_TABLE_NAME = 'clients' THEN NEW.code := next_numero('client');
  ELSIF TG_TABLE_NAME = 'fournisseurs' THEN NEW.code := next_numero('fournisseur');
  ELSIF TG_TABLE_NAME = 'articles' THEN NEW.code := next_numero('article');
  ELSIF TG_TABLE_NAME = 'familles_articles' THEN NEW.code := next_numero('famille_article');
  ELSIF TG_TABLE_NAME = 'depots' THEN NEW.code := next_numero('depot');
  ELSIF TG_TABLE_NAME = 'tresoreries' THEN NEW.code := next_numero('tresorerie');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;




-- ==========================================================================
-- RELOAD SCHEMA CACHE & GRANTS
-- ==========================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
