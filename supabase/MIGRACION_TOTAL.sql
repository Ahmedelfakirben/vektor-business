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


-- ==========================================================================
-- PARTE 2: DATOS, USUARIOS Y STORAGE
-- ==========================================================================

-- ==========================================================================
-- MIGRATION COMPLETE DE DONNEES - ERP DIGITAL ALT
-- Date: 2026-10-13T15:46:22.897Z
-- Source: Supabase Cloud (https://ymwzzlopuyglvffzntny.supabase.co)
-- Target: Supabase Self-Hosted Ubuntu (Coolify)
-- ==========================================================================

-- 1. DESACTIVAR TRIGGERS Y CONSTRAINTS TEMPORALMENTE PARA IMPORTACION LIMPIA
SET session_replication_role = 'replica';

-- ==========================================================================
-- 2. CREACION DEL USUARIO EN AUTH.USERS Y AUTH.IDENTITIES
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '96c2513a-3fee-471a-81df-00aafa454d6b',
  'authenticated',
  'authenticated',
  'admin@khalid.com',
  crypt('Admin123456!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"nom":"Admin","prenom":"Khalid","role":"admin"}'::jsonb,
  '2026-09-18T14:23:49.373705Z',
  NOW(),
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  '96c2513a-3fee-471a-81df-00aafa454d6b',
  '96c2513a-3fee-471a-81df-00aafa454d6b',
  jsonb_build_object('sub', '96c2513a-3fee-471a-81df-00aafa454d6b', 'email', 'admin@khalid.com'),
  'email',
  '96c2513a-3fee-471a-81df-00aafa454d6b',
  NOW(),
  '2026-09-18T14:23:49.373705Z',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 3. STORAGE BUCKET 'articles' (PUBLICO) Y POLICIES
-- ==========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('articles', 'articles', true, 52428800, NULL) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politicas de Storage si no existen
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Articles') THEN
    CREATE POLICY "Public Access Articles" ON storage.objects FOR SELECT USING (bucket_id = 'articles');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Upload Articles') THEN
    CREATE POLICY "Authenticated Upload Articles" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'articles');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Update Articles') THEN
    CREATE POLICY "Authenticated Update Articles" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'articles');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Delete Articles') THEN
    CREATE POLICY "Authenticated Delete Articles" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'articles');
  END IF;
END $$;

-- ==========================================================================
-- 4. IMPORTACION DE DATOS EN TABLAS (EN ORDEN DE DEPENDENCIAS)
-- ==========================================================================

-- Tabla: profiles (1 filas)
INSERT INTO public."profiles" ("id", "user_id", "nom", "prenom", "email", "role", "avatar_url", "actif", "created_at") VALUES ('f065eb02-d00e-4dcd-889f-73baac16b9b1', '96c2513a-3fee-471a-81df-00aafa454d6b', 'Admin', 'Khalid', 'admin@khalid.com', 'admin', NULL, TRUE, '2026-09-18T14:23:49.373705+00:00') ON CONFLICT DO NOTHING;

-- Tabla: tresoreries (2 filas)
INSERT INTO public."tresoreries" ("id", "code", "libelle", "type", "solde", "created_at", "solde_fiscale") VALUES ('5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'TRE00001', 'Caisse', 'caisse', 73300, '2026-09-18T14:53:37.429629+00:00', 4850) ON CONFLICT DO NOTHING;
INSERT INTO public."tresoreries" ("id", "code", "libelle", "type", "solde", "created_at", "solde_fiscale") VALUES ('1f8a66eb-e83e-4469-81b9-d930abfcd303', 'TRE00002', 'Banque Populaire (Compte Principal)', 'banque', 172610.8, '2026-09-19T18:29:03.454314+00:00', 145000) ON CONFLICT DO NOTHING;

-- Tabla: depots (2 filas)
INSERT INTO public."depots" ("id", "code", "libelle", "adresse", "responsable_id", "created_at") VALUES ('33763795-ec0a-4669-b59d-adc4fba7a4b7', 'DEP-001', 'Dépôt Principal', 'Siège Social', NULL, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."depots" ("id", "code", "libelle", "adresse", "responsable_id", "created_at") VALUES ('0a5f128d-0af3-428d-87e8-403739948247', 'DEP-002', 'Showroom Maarif', 'Boulevard Al Massira Al Khadra, Casablanca', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;

-- Tabla salaries: (0 filas)

-- Tabla: clients (8 filas)
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('2072028e-eb2f-4677-8851-37f0e98d877d', 'CL-0001', 'Client Comptoir (Passager)', 'Vente directe au magasin', 'Casablanca', '0522000000', 'comptoir@digital-alt.ma', '000000000000000', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('05ad72c0-cb32-41fd-91a0-487e1d40ad9b', 'CL-0002', 'Casablanca Tech Solutions SARL', '142 Boulevard d''Anfa, 4ème étage', 'Casablanca', '0522345678', 'contact@casatech.ma', '002345678000012', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('2086e90e-13e3-4be4-bdd4-c3e96d3bc372', 'CL-0003', 'Atlas Logistique & Fret', 'Zone Franche Tanger Med, Ilot 4', 'Tanger', '0539123456', 'achats@atlas-log.ma', '001987654000045', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('919ee7ba-08ae-4589-869a-e89d0cad6fb4', 'CL-0004', 'Cabinet Médical Dr. Youssef El Amrani', '28 Avenue Hassan II, Agdal', 'Rabat', '0537890123', 'dr.amrani@gmail.com', '003112233000088', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('fcd7d05b-49b2-47db-93eb-6dcbad607a56', 'CL-0005', 'Café Restaurant La Marina', 'Boulevard de la Corniche, Aïn Diab', 'Casablanca', '0522987654', 'direction@lamarina-cafe.ma', '004556677000034', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('b9b58e6e-bf95-4f14-b8a9-7324c70ed662', 'CL-0006', 'Maghreb Telecom Consulting', 'Avenue Mohamed V, Centre d''Affaires', 'Marrakech', '0524456789', 'admin@maghreb-telecom.com', '005667788000099', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('cdf7817f-164d-4768-9451-f54d7d555d69', 'CL-0007', 'Mme Mouna Bennani (VIP)', 'Résidence Les Palmiers, Villa 12', 'Rabat', '0661234567', 'mouna.bennani@yahoo.fr', NULL, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."clients" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('d23dfbe5-f47f-4bb3-a011-d70c5062a7ac', 'CL-0008', 'M. Karim Tazi', 'Quartier Racine, Rue Ahmed El Mokri', 'Casablanca', '0662987654', 'karim.tazi88@gmail.com', NULL, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;

-- Tabla: fournisseurs (6 filas)
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('32dfbf93-d05b-44b9-b7b1-15dec7e96b27', 'FR-0001', 'Apple Distribution Maroc', 'Sidi Maârouf, Zenith Millenium', 'Casablanca', '0522889900', 'orders@apple-distrib.ma', '001111222000033', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('22532be5-76ee-4847-873c-13c615460740', 'FR-0002', 'Samsung Electronics Maghreb', 'Twin Center, Tour Ouest 18ème', 'Casablanca', '0522445566', 'sales@samsung-maghreb.ma', '002222333000044', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('2dc65885-632d-4f5c-9ffb-8c4c68d7207b', 'FR-0003', 'Disty Technologies Maroc', 'Zone Industrielle Oukacha', 'Casablanca', '0522778899', 'commercial@disty.ma', '003333444000055', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('54b45513-024e-4358-a9b4-b8c24fc163db', 'FR-0004', 'Disway SA', 'Lotissement La Colline, Sidi Maârouf', 'Casablanca', '0522789000', 'contact@disway.com', '004444555000066', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('188e8353-cbe7-43c7-9d85-747d4636a36a', 'FR-0005', 'Nespresso Maroc (Daba Maroc)', 'Boulevard Sidi Mohamed Ben Abdellah', 'Casablanca', '0522394041', 'club@nespresso-maroc.ma', '005555666000077', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."fournisseurs" ("id", "code", "raison_sociale", "adresse", "ville", "telephone", "email", "ice", "created_at", "updated_at") VALUES ('af485b6c-3a1b-4d16-9356-c9b73601d635', 'FR-0006', 'Société des Boissons du Maroc (SBM)', 'Boulevard Ahl Loghlam, Aïn Sebaâ', 'Casablanca', '0522765432', 'commande@sbm.co.ma', '006666777000088', '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;

-- Tabla: familles_articles (6 filas)
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('3f712b46-1818-42bc-a741-9139f4fc19c3', 'FAM-TEL', 'Smartphones & Téléphonie', 'Smartphones haut de gamme, moyenne gamme et téléphones mobiles', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('8ee0f569-f88a-4506-9708-f21c80b80acc', 'FAM-INF', 'Informatique & PC', 'Ordinateurs portables, PC de bureau et moniteurs', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('1286595c-b257-4162-b07b-4137910858ca', 'FAM-ACC', 'Accessoires & Périphériques', 'Souris, claviers, chargeurs, supports et connectique', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('5f06fbe9-488a-4332-a18b-0903f96e2c9f', 'FAM-AUD', 'Audio & Casques', 'Écouteurs sans fil, casques Bluetooth et enceintes', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('4614a9c8-38dc-42a4-bc56-28190c902cd6', 'FAM-BOI', 'Boissons & Pause Café', 'Canettes, boissons énergisantes, café et rafraîchissements', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."familles_articles" ("id", "code", "libelle", "description", "created_at") VALUES ('5b5cb059-937f-4034-84e5-8ae4661a2152', 'FAM-BUR', 'Réseaux & Bureautique', 'Routeurs Wi-Fi 6, switchs, câbles réseau et sacs PC', '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;

-- Tabla: sous_familles_articles (8 filas)
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('2d707c7a-f130-44dc-9218-20b213e16179', '3f712b46-1818-42bc-a741-9139f4fc19c3', 'Apple iPhone', 'Smartphones iOS Apple', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('aec5f32d-25a2-4984-8c1a-0ff262ed8d5b', '3f712b46-1818-42bc-a741-9139f4fc19c3', 'Samsung Galaxy', 'Smartphones Android Samsung', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('eb9c5c90-9a65-49ba-84bf-cf05587d50c4', '8ee0f569-f88a-4506-9708-f21c80b80acc', 'PC Portables & Mac', 'Laptops Ultrabooks et MacBooks', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('b5512cc5-02cc-4a3a-9e54-e28809342bbb', '5f06fbe9-488a-4332-a18b-0903f96e2c9f', 'Casques & Écouteurs', 'Audio sans fil avec réduction de bruit', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('394d46b8-027b-4170-8882-f48d0d0f01aa', '1286595c-b257-4162-b07b-4137910858ca', 'Claviers & Souris', 'Périphériques bureautiques et ergonomiques', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('1971b4d0-d34b-4da5-8a4e-459d50d0abe5', '1286595c-b257-4162-b07b-4137910858ca', 'Chargeurs & Câbles', 'Chargeurs rapides GaN et câbles tressés', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('0e425742-5d68-4957-9510-8791d0deaa6a', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 'Boissons & Snacks', 'Consommables pour espace accueil et pause', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."sous_familles_articles" ("id", "famille_id", "libelle", "description", "type_code_requis", "created_at") VALUES ('77cd1f17-68a1-430c-a93c-369823f51b33', '5b5cb059-937f-4034-84e5-8ae4661a2152', 'Équipements Réseau', 'Routeurs et accessoires de connectivité', NULL, '2026-09-19T18:29:03.454314+00:00') ON CONFLICT DO NOTHING;

-- Tabla: articles (24 filas)
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('84923b32-43a8-4048-89af-3c8f5fefbe21', 'ART-0001', 'Apple iPhone 15 Pro 128GB Titane Naturel', '3f712b46-1818-42bc-a741-9139f4fc19c3', 10800, 12499, 20, 'unité', 3, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '2d707c7a-f130-44dc-9218-20b213e16179', '0195949038235', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('b60eff83-b334-4f90-9355-750b395ab502', 'ART-0002', 'Apple iPhone 15 128GB Bleu Pastel', '3f712b46-1818-42bc-a741-9139f4fc19c3', 7900, 9299, 20, 'unité', 5, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '2d707c7a-f130-44dc-9218-20b213e16179', '0195949035128', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('f3fad305-a1dc-4f52-8505-0f0cbb5f5316', 'ART-0003', 'Samsung Galaxy S24 Ultra 256GB Noir Titane', '3f712b46-1818-42bc-a741-9139f4fc19c3', 11500, 13999, 20, 'unité', 3, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'aec5f32d-25a2-4984-8c1a-0ff262ed8d5b', '8806091837425', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('a8c88370-30f2-4f2a-8897-7f68d6e912a7', 'ART-0004', 'Samsung Galaxy A55 5G 128GB Bleu Nuit', '3f712b46-1818-42bc-a741-9139f4fc19c3', 3100, 3899, 20, 'unité', 8, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'aec5f32d-25a2-4984-8c1a-0ff262ed8d5b', '8806095034123', 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('52aa854c-c073-41c3-a046-b715e8911af7', 'ART-0005', 'MacBook Air 13" Apple M3 8Go/256Go Gris Sidéral', '8ee0f569-f88a-4506-9708-f21c80b80acc', 11200, 13490, 20, 'unité', 4, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'eb9c5c90-9a65-49ba-84bf-cf05587d50c4', '0195949112233', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('7f3e5e8a-1a02-4ddc-9c6e-06d276ac772d', 'ART-0006', 'Dell XPS 13 Plus Intel Core i7 16Go/512Go SSD', '8ee0f569-f88a-4506-9708-f21c80b80acc', 13900, 16800, 20, 'unité', 2, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'eb9c5c90-9a65-49ba-84bf-cf05587d50c4', '5397184561234', 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('2e52aa64-68bc-46dc-966a-568a341bdd35', 'ART-0007', 'Sony WH-1000XM5 Casque Sans Fil ANC Argent', '5f06fbe9-488a-4332-a18b-0903f96e2c9f', 2750, 3490, 20, 'unité', 5, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'b5512cc5-02cc-4a3a-9e54-e28809342bbb', '4548736132580', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('f6a30a16-955a-4946-b62c-44ef297acfee', 'ART-0008', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', '5f06fbe9-488a-4332-a18b-0903f96e2c9f', 2150, 2690, 20, 'unité', 10, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'b5512cc5-02cc-4a3a-9e54-e28809342bbb', '0195949052453', 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', 'ART-0009', 'Apple Watch Series 9 GPS 45mm Minuit', '1286595c-b257-4162-b07b-4137910858ca', 3600, 4490, 20, 'unité', 4, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '0195949087654', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('1db94d4d-8e6e-421d-a639-deb8e70276ee', 'ART-0010', 'Clavier Logitech MX Keys S Sans Fil Graphite', '1286595c-b257-4162-b07b-4137910858ca', 890, 1190, 20, 'unité', 6, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '5099206103456', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('722fb419-99ba-4d01-a3bc-1690666aea6f', 'ART-0011', 'Souris Ergonomique Logitech MX Master 3S', '1286595c-b257-4162-b07b-4137910858ca', 740, 990, 20, 'unité', 8, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '5099206098765', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('5caed1a7-00d8-46c9-aa88-e5acc5b370c2', 'ART-0012', 'Écran Dell UltraSharp 27" 4K USB-C Hub IPS Black', '8ee0f569-f88a-4506-9708-f21c80b80acc', 3700, 4600, 20, 'unité', 3, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '5397184234567', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('3ffe12d0-0b17-4976-aeee-5a434428bd8f', 'ART-0013', 'Machine à Café Nespresso Vertuo Pop Noir Réglisse', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 890, 1299, 20, 'unité', 4, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '0e425742-5d68-4957-9510-8791d0deaa6a', '7630054412345', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('e20c6a90-79b4-49d2-af85-83b3749b9b1e', 'ART-0014', 'Boîte de 10 Capsules Nespresso Master Origin Colombia', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 48, 68, 20, 'pack', 25, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '0e425742-5d68-4957-9510-8791d0deaa6a', '7630054498765', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('52278f9f-9b8c-4208-884f-7d68a2397ff2', 'ART-0015', 'Pack 6 Canettes Coca-Cola Original Taste 33cl', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 24, 36, 20, 'pack', 40, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '0e425742-5d68-4957-9510-8791d0deaa6a', '5449000000996', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('3f083af1-13dd-4176-a1cc-9a3dd39285f2', 'ART-0016', 'Canette Red Bull Energy Drink 250ml', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 14.5, 22, 20, 'unité', 50, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '0e425742-5d68-4957-9510-8791d0deaa6a', '9002490100070', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('7be153ab-ac43-4e9f-a6b5-50353aa2e579', 'ART-0017', 'Bouteille Eau Minérale Naturelle Sidi Ali 1.5L', '4614a9c8-38dc-42a4-bc56-28190c902cd6', 3.8, 6, 0, 'unité', 60, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '0e425742-5d68-4957-9510-8791d0deaa6a', '6111242100018', 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('90227077-5d31-4992-b0ab-5c236bfdd015', 'ART-0018', 'Disque SSD Externe Samsung T7 Shield 1To Bleu', '1286595c-b257-4162-b07b-4137910858ca', 850, 1150, 20, 'unité', 6, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '8806090312456', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('802162f6-51b3-48c2-9d86-86be6748c870', 'ART-0019', 'Chargeur Secteur Rapide GaN Anker 65W 3 Ports USB-C', '1286595c-b257-4162-b07b-4137910858ca', 320, 449, 20, 'unité', 12, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '1971b4d0-d34b-4da5-8a4e-459d50d0abe5', '0194644081234', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('74e42732-de59-4ed5-b0ac-625705b3f01c', 'ART-0020', 'Câble Tressé USB-C vers USB-C 100W 2 Mètres Noir', '1286595c-b257-4162-b07b-4137910858ca', 110, 169, 20, 'unité', 20, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '1971b4d0-d34b-4da5-8a4e-459d50d0abe5', '0194644012987', 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('5d1d72ad-f845-4142-b097-aa68ef11c946', 'ART-0021', 'Support Ordinateur Portable Ergonomique Aluminium', '1286595c-b257-4162-b07b-4137910858ca', 150, 249, 20, 'unité', 15, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '394d46b8-027b-4170-8882-f48d0d0f01aa', '6934177723456', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('40584aca-bba7-4bfc-9652-e3e36a64dbad', 'ART-0022', 'Routeur Wi-Fi 6 TP-Link Archer AX55 Dual-Band Gigabit', '5b5cb059-937f-4034-84e5-8ae4661a2152', 580, 799, 20, 'unité', 5, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '77cd1f17-68a1-430c-a93c-369823f51b33', '6935364052345', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('cf2bdde4-4b1e-4174-a7a3-0dfebdd0766a', 'ART-0023', 'Enceinte Portable Bluetooth JBL Flip 6 Étanche Noir', '5f06fbe9-488a-4332-a18b-0903f96e2c9f', 890, 1249, 20, 'unité', 7, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', 'b5512cc5-02cc-4a3a-9e54-e28809342bbb', '6925281987654', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;
INSERT INTO public."articles" ("id", "code", "designation", "famille_id", "prix_achat", "prix_vente", "tva", "unite", "seuil_alerte", "actif", "created_at", "updated_at", "sous_famille_id", "code_barre", "image_url") VALUES ('d6858c33-7b4d-4184-b43d-718793638a81', 'ART-0024', 'Sac à Dos Business PC 15.6" Antivol Imperméable', '5b5cb059-937f-4034-84e5-8ae4661a2152', 290, 449, 20, 'unité', 10, TRUE, '2026-09-19T18:29:03.454314+00:00', '2026-09-19T18:29:03.454314+00:00', '77cd1f17-68a1-430c-a93c-369823f51b33', '0926363214567', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80') ON CONFLICT DO NOTHING;

-- Tabla: sequences (15 filas)
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('decb0dfa-6563-467f-917c-fb93aa8ea298', 'bon_retour_achat', 'BRA', 0, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('2689547d-b574-4c98-b333-b67b1db5c974', 'salarie', 'EMP', 0, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('60b84b2f-3376-44b5-95c7-ef6314d863c9', 'article', 'ART', 24, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('8fb8b19e-99e3-4bc0-b661-3fca0bb68688', 'client', 'CL', 8, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('5be2d0ce-d48a-4c4a-80bd-62016d22c651', 'fournisseur', 'FR', 6, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('28c5463d-e448-4856-81d4-faec538ccae0', 'famille_article', 'FAM', 6, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('0a94a58e-48da-4850-9f7c-0f0118e2fd9c', 'depot', 'DEP', 2, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('9b1197cc-b7ab-414b-8134-da78b1e18d5f', 'tresorerie', 'TRE', 2, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('4fcfc4ab-918d-4ec4-a084-b72c81cde0e7', 'devis', 'DEV', 3, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('f1281878-8630-484a-a818-a9dcad318ae3', 'bon_retour', 'BR', 1, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('948a7b78-6814-4e81-b8ac-b6382907acb7', 'bon_commande', 'BC', 1, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('45570713-4357-45ae-961c-60ff063f4365', 'bon_achat', 'BA', 2, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('a6a000e6-00c9-434a-9c98-add0e37fd248', 'bon_livraison', 'BL', 4, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('cc2c5311-6f4b-4499-9674-d56eff2aacf4', 'retour_pos', 'RET', 0, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;
INSERT INTO public."sequences" ("id", "type", "prefixe", "dernier_numero", "format") VALUES ('9caa9018-546e-48a1-9394-f323103d1220', 'vente_pos', 'POS', 10, '{prefixe}-{annee}-{numero}') ON CONFLICT DO NOTHING;

-- Tabla: stock (48 filas)
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('6670fb99-d0cf-464c-ac25-6f99fc601b79', 'f3fad305-a1dc-4f52-8505-0f0cbb5f5316', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 10, 10) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('7927dd7e-bb2f-444f-9302-cb34bbf97a44', 'a8c88370-30f2-4f2a-8897-7f68d6e912a7', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 35, 35) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('14c348ef-8367-4bad-9b06-57d4709f302e', '52aa854c-c073-41c3-a046-b715e8911af7', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 8, 8) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('30420738-596d-48a0-be50-4145f388a298', '7f3e5e8a-1a02-4ddc-9c6e-06d276ac772d', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 6, 6) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('455f5a21-f0b0-405e-b379-0566f9afc887', '2e52aa64-68bc-46dc-966a-568a341bdd35', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 18, 18) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('c18f372e-e7c1-4c05-92a2-120764825761', 'f6a30a16-955a-4946-b62c-44ef297acfee', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 45, 45) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('68372f4e-e7eb-4b89-8c18-9538392d3ac2', '1db94d4d-8e6e-421d-a639-deb8e70276ee', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 28, 28) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('54a60b9b-74a4-4fae-b42d-6e06beda5c22', '722fb419-99ba-4d01-a3bc-1690666aea6f', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 32, 32) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('e7e59a68-7731-4802-9851-ab6ec383178b', '5caed1a7-00d8-46c9-aa88-e5acc5b370c2', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 12, 12) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('cb0d9f60-5b4f-4958-a3ca-003f81c0b9f6', '3ffe12d0-0b17-4976-aeee-5a434428bd8f', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 16, 16) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('1c7f968f-f821-441c-bc4f-f01a554bfa7d', 'e20c6a90-79b4-49d2-af85-83b3749b9b1e', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 120, 120) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('99d9a242-0975-4b63-8983-dc23486e7691', '52278f9f-9b8c-4208-884f-7d68a2397ff2', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 180, 180) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('7c5e52c6-1936-4eef-b872-6336ac323846', '3f083af1-13dd-4176-a1cc-9a3dd39285f2', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 240, 240) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('b6708b74-467b-40d2-a6a7-bb9f2f69894c', '7be153ab-ac43-4e9f-a6b5-50353aa2e579', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 300, 300) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('c6dba11c-fa58-49b1-9480-c0b5452a9f64', '90227077-5d31-4992-b0ab-5c236bfdd015', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 25, 25) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('3caa86f8-12b6-4757-b618-7c725e652601', '802162f6-51b3-48c2-9d86-86be6748c870', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 50, 50) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('910a7445-f4f3-446c-bae2-5d25b4ce3474', '74e42732-de59-4ed5-b0ac-625705b3f01c', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 90, 90) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('16aa0763-dfc8-4ed4-aff2-8b1de817ea26', '5d1d72ad-f845-4142-b097-aa68ef11c946', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 40, 40) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('d3227ff7-5cfc-4f98-a098-614b7cdc96d1', '40584aca-bba7-4bfc-9652-e3e36a64dbad', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 15, 15) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('106c355d-8761-4c16-9250-24d936097109', 'cf2bdde4-4b1e-4174-a7a3-0dfebdd0766a', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 20, 20) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('931c41b3-ad3f-42b0-a5b8-0ece4381eb65', 'd6858c33-7b4d-4184-b43d-718793638a81', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 30, 30) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('60531a8e-704c-4209-8826-7315a517ed6b', '84923b32-43a8-4048-89af-3c8f5fefbe21', '0a5f128d-0af3-428d-87e8-403739948247', 4, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('999f994d-6ad4-40cf-bce0-508f88fcf37a', 'b60eff83-b334-4f90-9355-750b395ab502', '0a5f128d-0af3-428d-87e8-403739948247', 6, 6) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('acee9078-d8a1-4866-a4a8-e91d9c5e49cb', 'f3fad305-a1dc-4f52-8505-0f0cbb5f5316', '0a5f128d-0af3-428d-87e8-403739948247', 3, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('4dff0bf1-6cfc-4136-8e3e-675e6a958949', 'a8c88370-30f2-4f2a-8897-7f68d6e912a7', '0a5f128d-0af3-428d-87e8-403739948247', 12, 12) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('eda9b354-0f48-45c5-913a-004be8332b1f', '52aa854c-c073-41c3-a046-b715e8911af7', '0a5f128d-0af3-428d-87e8-403739948247', 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('4b3ff2b0-f0d0-46d8-9f7d-5e3e6600e1d3', '7f3e5e8a-1a02-4ddc-9c6e-06d276ac772d', '0a5f128d-0af3-428d-87e8-403739948247', 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('49f717fe-9fe2-408c-b7b7-665d62f7d660', '2e52aa64-68bc-46dc-966a-568a341bdd35', '0a5f128d-0af3-428d-87e8-403739948247', 5, 5) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('f0eb5fa9-c78c-4352-b13c-061d9bf334da', 'f6a30a16-955a-4946-b62c-44ef297acfee', '0a5f128d-0af3-428d-87e8-403739948247', 15, 15) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('4e0a0221-3be9-4709-a03c-47126f88de62', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', '0a5f128d-0af3-428d-87e8-403739948247', 4, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('5b988c46-6d1f-45e7-bf7c-f46a92be99cf', '1db94d4d-8e6e-421d-a639-deb8e70276ee', '0a5f128d-0af3-428d-87e8-403739948247', 8, 8) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('5096423e-7d37-453b-91ae-199c9c1fb336', '722fb419-99ba-4d01-a3bc-1690666aea6f', '0a5f128d-0af3-428d-87e8-403739948247', 10, 10) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('35e39c0e-0049-44f7-8aa7-e68e6b0930dd', '5caed1a7-00d8-46c9-aa88-e5acc5b370c2', '0a5f128d-0af3-428d-87e8-403739948247', 3, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('4af54d35-4660-4d53-bb73-930303e76b24', '3ffe12d0-0b17-4976-aeee-5a434428bd8f', '0a5f128d-0af3-428d-87e8-403739948247', 5, 5) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('f809a105-09fe-40dd-98bb-60f5b6147879', 'e20c6a90-79b4-49d2-af85-83b3749b9b1e', '0a5f128d-0af3-428d-87e8-403739948247', 40, 40) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('379b72ec-cbb3-4ac0-aa98-d99a9fef0660', '52278f9f-9b8c-4208-884f-7d68a2397ff2', '0a5f128d-0af3-428d-87e8-403739948247', 48, 48) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('2eaf5e1c-e5dd-4bdd-b5dd-f35d752efdd0', '3f083af1-13dd-4176-a1cc-9a3dd39285f2', '0a5f128d-0af3-428d-87e8-403739948247', 60, 60) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('713b9fee-9a23-4b59-a793-18f27896bc2c', '7be153ab-ac43-4e9f-a6b5-50353aa2e579', '0a5f128d-0af3-428d-87e8-403739948247', 72, 72) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('25f0920c-9ad5-4f55-ad94-5d42870959d4', '90227077-5d31-4992-b0ab-5c236bfdd015', '0a5f128d-0af3-428d-87e8-403739948247', 8, 8) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('886a7904-4533-4deb-af6e-500543721004', '802162f6-51b3-48c2-9d86-86be6748c870', '0a5f128d-0af3-428d-87e8-403739948247', 20, 20) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('fb40ae77-c925-4692-9d1a-72b86a03cef4', '74e42732-de59-4ed5-b0ac-625705b3f01c', '0a5f128d-0af3-428d-87e8-403739948247', 35, 35) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('e8eb4bc9-b096-4693-912b-1fa4a7ac9f0a', '5d1d72ad-f845-4142-b097-aa68ef11c946', '0a5f128d-0af3-428d-87e8-403739948247', 12, 12) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('64bf7eb1-85c0-4c91-bf44-4cd20293f2eb', '40584aca-bba7-4bfc-9652-e3e36a64dbad', '0a5f128d-0af3-428d-87e8-403739948247', 4, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('837cd60b-8fd0-44b8-882d-69ac0822d44d', 'cf2bdde4-4b1e-4174-a7a3-0dfebdd0766a', '0a5f128d-0af3-428d-87e8-403739948247', 6, 6) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('3b4bd5fc-2d4a-49c0-a8e8-de6d61aa07dd', 'd6858c33-7b4d-4184-b43d-718793638a81', '0a5f128d-0af3-428d-87e8-403739948247', 8, 8) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('c1233459-f206-40a0-97a4-bbe4d6a55d87', 'b60eff83-b334-4f90-9355-750b395ab502', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 21, 22) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('ec78df36-3414-469f-b096-d906cd76ea4d', '84923b32-43a8-4048-89af-3c8f5fefbe21', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 12, 14) ON CONFLICT DO NOTHING;
INSERT INTO public."stock" ("id", "article_id", "depot_id", "quantite", "quantite_fiscale") VALUES ('b56012c3-5ab7-4179-8dc7-8fc324648add', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 13, 15) ON CONFLICT DO NOTHING;

-- Tabla: devis (3 filas)
INSERT INTO public."devis" ("id", "numero", "date", "client_id", "commercial_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "validite_jours", "created_at", "updated_at", "inclure_tva", "is_regularisation") VALUES ('fd46e092-6a49-478a-8e1c-df95cf2d2c83', 'DEV-2026-0001', '2026-09-14', '05ad72c0-cb32-41fd-91a0-487e1d40ad9b', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', 'accepte', 30150, 6030, 36180, 'Équipement pour le pôle développement. Livraison sous 48h après signature.', 30, '2026-09-14T18:44:53.275683+00:00', '2026-09-14T18:44:53.275683+00:00', TRUE, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis" ("id", "numero", "date", "client_id", "commercial_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "validite_jours", "created_at", "updated_at", "inclure_tva", "is_regularisation") VALUES ('adfbb475-3da5-4fbc-9c08-c7299e4e70ff', 'DEV-2026-0002', '2026-09-17', '2086e90e-13e3-4be4-bdd4-c3e96d3bc372', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', 'brouillon', 14493.33, 2898.67, 17392, 'Flotte de smartphones pour les agents logistiques de terrain.', 15, '2026-09-17T18:44:53.275683+00:00', '2026-09-17T18:44:53.275683+00:00', TRUE, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis" ("id", "numero", "date", "client_id", "commercial_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "validite_jours", "created_at", "updated_at", "inclure_tva", "is_regularisation") VALUES ('87475415-a968-4cda-a4c9-d274504f9eff', 'DEV-2026-0003', '2026-09-16', '919ee7ba-08ae-4589-869a-e89d0cad6fb4', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', 'envoye', 15816.67, 3163.33, 18980, 'Poste de consultation médicale avec périphériques ergonomiques.', 30, '2026-09-16T18:44:53.275683+00:00', '2026-09-16T18:44:53.275683+00:00', TRUE, FALSE) ON CONFLICT DO NOTHING;

-- Tabla: devis_lignes (7 filas)
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('a9391bbc-552f-405b-a1d3-f41d27fda946', 'fd46e092-6a49-478a-8e1c-df95cf2d2c83', '52aa854c-c073-41c3-a046-b715e8911af7', 'MacBook Air 13" Apple M3 8Go/256Go Gris Sidéral', 2, 11241.67, 20, 22483.33, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('497eca00-750b-4636-acab-b5b381efd349', 'fd46e092-6a49-478a-8e1c-df95cf2d2c83', '5caed1a7-00d8-46c9-aa88-e5acc5b370c2', 'Écran Dell UltraSharp 27" 4K USB-C Hub IPS Black', 2, 3833.33, 20, 7666.67, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('c344a1b2-95e5-4e79-98ea-88a29c2be9b3', 'adfbb475-3da5-4fbc-9c08-c7299e4e70ff', 'a8c88370-30f2-4f2a-8897-7f68d6e912a7', 'Samsung Galaxy A55 5G 128GB Bleu Nuit', 4, 3249.17, 20, 12996.67, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('a83bd09d-10be-4b81-bd49-7214ae6aa48a', 'adfbb475-3da5-4fbc-9c08-c7299e4e70ff', '802162f6-51b3-48c2-9d86-86be6748c870', 'Chargeur Secteur Rapide GaN Anker 65W 3 Ports USB-C', 4, 374.17, 20, 1496.67, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('5801ba22-2ebf-4206-9afd-f5a4aee7d2eb', '87475415-a968-4cda-a4c9-d274504f9eff', '7f3e5e8a-1a02-4ddc-9c6e-06d276ac772d', 'Dell XPS 13 Plus Intel Core i7 16Go/512Go SSD', 1, 14000, 20, 14000, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('ffb70b60-e11b-4851-8641-b490bf029613', '87475415-a968-4cda-a4c9-d274504f9eff', '1db94d4d-8e6e-421d-a639-deb8e70276ee', 'Clavier Logitech MX Keys S Sans Fil Graphite', 1, 991.67, 20, 991.67, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."devis_lignes" ("id", "devis_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('9f371ed6-b795-41ba-8a99-c26064d49b78', '87475415-a968-4cda-a4c9-d274504f9eff', '722fb419-99ba-4d01-a3bc-1690666aea6f', 'Souris Ergonomique Logitech MX Master 3S', 1, 825, 20, 825, 3, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;

-- Tabla: bon_commandes (1 filas)
INSERT INTO public."bon_commandes" ("id", "numero", "date", "fournisseur_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "inclure_tva") VALUES ('79287ae2-7cc6-423e-8f04-cc2aeb16dfee', 'BC-2026-0001', '2026-09-12', '32dfbf93-d05b-44b9-b7b1-15dec7e96b27', 'recu', 129500, 25900, 155400, 'Commande réassort trimestriel iPhone 15 Pro & AirPods Pro.', '2026-09-12T18:44:53.275683+00:00', TRUE) ON CONFLICT DO NOTHING;

-- Tabla: bon_commande_lignes (2 filas)
INSERT INTO public."bon_commande_lignes" ("id", "bon_commande_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "codes_articles") VALUES ('ae27c88b-36ff-44e3-a012-9b57b5ac97ff', '79287ae2-7cc6-423e-8f04-cc2aeb16dfee', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 10, 10800, 20, 108000, 1, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_commande_lignes" ("id", "bon_commande_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "codes_articles") VALUES ('d2c5a543-e4ec-488a-bafb-da0ff0662876', '79287ae2-7cc6-423e-8f04-cc2aeb16dfee', 'f6a30a16-955a-4946-b62c-44ef297acfee', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', 10, 2150, 20, 21500, 2, ARRAY[]::text[]) ON CONFLICT DO NOTHING;

-- Tabla: bon_achats (2 filas)
INSERT INTO public."bon_achats" ("id", "numero", "date", "fournisseur_id", "bon_commande_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva") VALUES ('8d4d4f78-d1f9-40dd-9310-91cae03cb961', 'BA-2026-0001', '2026-09-13', '32dfbf93-d05b-44b9-b7b1-15dec7e96b27', '79287ae2-7cc6-423e-8f04-cc2aeb16dfee', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'valide', 129500, 25900, 155400, 'Facture fournisseur N° FAC-APPLE-88392 réglée par virement bancaire.', '2026-09-13T18:44:53.275683+00:00', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'virement', 'paye', 155400, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_achats" ("id", "numero", "date", "fournisseur_id", "bon_commande_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva") VALUES ('0c31fa39-3cfd-4b8c-90fe-7cee6d7856ae', 'BA-2026-0002', '2026-09-16', 'af485b6c-3a1b-4d16-9356-c9b73601d635', NULL, '0a5f128d-0af3-428d-87e8-403739948247', 'valide', 1205, 241, 1446, 'Approvisionnement boissons showroom payé en espèces.', '2026-09-16T18:44:53.275683+00:00', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'especes', 'paye', 1446, TRUE) ON CONFLICT DO NOTHING;

-- Tabla: bon_achat_lignes (4 filas)
INSERT INTO public."bon_achat_lignes" ("id", "bon_achat_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles") VALUES ('36651750-dc08-4322-98ba-e89f98bc14b4', '8d4d4f78-d1f9-40dd-9310-91cae03cb961', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 10, 10800, 20, 108000, 1, NULL, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_achat_lignes" ("id", "bon_achat_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles") VALUES ('db4c78f9-6ce7-4681-8bb5-50e3be422efc', '8d4d4f78-d1f9-40dd-9310-91cae03cb961', 'f6a30a16-955a-4946-b62c-44ef297acfee', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', 10, 2150, 20, 21500, 2, NULL, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_achat_lignes" ("id", "bon_achat_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles") VALUES ('eaba922d-99c4-4d14-8c81-95007293c45d', '0c31fa39-3cfd-4b8c-90fe-7cee6d7856ae', '52278f9f-9b8c-4208-884f-7d68a2397ff2', 'Pack 6 Canettes Coca-Cola Original Taste 33cl', 20, 24, 20, 480, 1, NULL, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_achat_lignes" ("id", "bon_achat_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles") VALUES ('c35b175d-9cd5-42ae-925e-852ef1570e77', '0c31fa39-3cfd-4b8c-90fe-7cee6d7856ae', '3f083af1-13dd-4176-a1cc-9a3dd39285f2', 'Canette Red Bull Energy Drink 250ml', 50, 14.5, 20, 725, 2, NULL, ARRAY[]::text[]) ON CONFLICT DO NOTHING;

-- Tabla: bon_livraisons (4 filas)
INSERT INTO public."bon_livraisons" ("id", "numero", "date", "client_id", "devis_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva", "is_regularisation") VALUES ('c609034f-8e29-493e-8b25-e391dcd89fca', 'BL-2026-0001', '2026-09-15', '05ad72c0-cb32-41fd-91a0-487e1d40ad9b', 'fd46e092-6a49-478a-8e1c-df95cf2d2c83', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'valide', 30150, 6030, 36180, 'Matériel réceptionné en bon état au siège de Casablanca Tech.', '2026-09-15T18:44:53.275683+00:00', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'virement', 'paye', 36180, TRUE, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraisons" ("id", "numero", "date", "client_id", "devis_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva", "is_regularisation") VALUES ('b507d004-cbee-484e-8b7e-e011e695340b', 'BL-2026-0002', '2026-09-17', 'fcd7d05b-49b2-47db-93eb-6dcbad607a56', NULL, '0a5f128d-0af3-428d-87e8-403739948247', 'valide', 1365.83, 273.17, 1639, 'Livraison machine Vertuo et pack de capsules dégustation.', '2026-09-17T18:44:53.275683+00:00', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'carte', 'paye', 1639, TRUE, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraisons" ("id", "numero", "date", "client_id", "devis_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva", "is_regularisation") VALUES ('f07c3c70-1e13-4625-9536-b00933196c6a', 'BL-2026-0003', '2026-09-18', 'd23dfbe5-f47f-4bb3-a011-d70c5062a7ac', NULL, '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'valide', 12657.5, 2531.5, 15189, 'Acompte 5000 DH versé par chèque N° 4589231.', '2026-09-18T18:44:53.275683+00:00', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'cheque', 'partiel', 5000, TRUE, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraisons" ("id", "numero", "date", "client_id", "devis_id", "depot_id", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva", "is_regularisation") VALUES ('b7220e84-7989-4dfc-9a4d-dae1e357b4b3', 'BL-2026-0004', '2026-09-20', '05ad72c0-cb32-41fd-91a0-487e1d40ad9b', NULL, '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'valide', 4490, 0, 4490, NULL, '2026-09-20T13:47:52.51463+00:00', NULL, NULL, 'impaye', 0, FALSE, FALSE) ON CONFLICT DO NOTHING;

-- Tabla: bon_livraison_lignes (7 filas)
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('393fcb38-14d7-40b8-85f8-19bcbd09bd13', 'c609034f-8e29-493e-8b25-e391dcd89fca', '52aa854c-c073-41c3-a046-b715e8911af7', 'MacBook Air 13" Apple M3 8Go/256Go Gris Sidéral', 2, 11241.67, 20, 22483.33, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('06704d83-0ad5-4a2c-807b-ee8295a3aeaa', 'c609034f-8e29-493e-8b25-e391dcd89fca', '5caed1a7-00d8-46c9-aa88-e5acc5b370c2', 'Écran Dell UltraSharp 27" 4K USB-C Hub IPS Black', 2, 3833.33, 20, 7666.67, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('a7cf9310-7e8a-4d8f-aaa7-ed6210a529c9', 'b507d004-cbee-484e-8b7e-e011e695340b', '3ffe12d0-0b17-4976-aeee-5a434428bd8f', 'Machine à Café Nespresso Vertuo Pop Noir Réglisse', 1, 1082.5, 20, 1082.5, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('76df6dbc-a1a5-4268-942d-7c824fb0fe31', 'b507d004-cbee-484e-8b7e-e011e695340b', 'e20c6a90-79b4-49d2-af85-83b3749b9b1e', 'Boîte de 10 Capsules Nespresso Master Origin Colombia', 5, 56.67, 20, 283.33, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('6911d960-c778-469c-a411-ef31216f7606', 'f07c3c70-1e13-4625-9536-b00933196c6a', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 1, 10415.83, 20, 10415.83, 1, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('6e85fe27-4a05-4b09-b42e-166dd5bfad79', 'f07c3c70-1e13-4625-9536-b00933196c6a', 'f6a30a16-955a-4946-b62c-44ef297acfee', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', 1, 2241.67, 20, 2241.67, 2, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."bon_livraison_lignes" ("id", "bon_livraison_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles", "is_regularisation") VALUES ('d968130b-8986-4d0d-96e2-990cb315d0a9', 'b7220e84-7989-4dfc-9a4d-dae1e357b4b3', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', 'Apple Watch Series 9 GPS 45mm Minuit', 1, 4490, 20, 4490, 0, NULL, ARRAY[]::text[], FALSE) ON CONFLICT DO NOTHING;

-- Tabla: bon_retours (1 filas)
INSERT INTO public."bon_retours" ("id", "numero", "date", "client_id", "bon_livraison_id", "depot_id", "motif", "statut", "montant_ht", "montant_tva", "montant_ttc", "notes", "created_at", "tresorerie_id", "mode_paiement", "statut_paiement", "montant_regle", "inclure_tva") VALUES ('66b1deae-8d5a-4339-8821-58e1091f47b4', 'BR-2026-0001', '2026-09-18', '05ad72c0-cb32-41fd-91a0-487e1d40ad9b', 'c609034f-8e29-493e-8b25-e391dcd89fca', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'Écran présentant une ligne de pixels défectueuse à l''allumage (Remplacement sous garantie)', 'valide', 3833.33, 766.67, 4600, 'Matériel repris et réintégré pour retour constructeur.', '2026-09-18T18:44:53.275683+00:00', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'virement', 'paye', 4600, TRUE) ON CONFLICT DO NOTHING;

-- Tabla: bon_retour_lignes (1 filas)
INSERT INTO public."bon_retour_lignes" ("id", "bon_retour_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "ordre", "code_article", "codes_articles") VALUES ('0f4713c0-4f04-4786-b43c-ca7821d12c9d', '66b1deae-8d5a-4339-8821-58e1091f47b4', '5caed1a7-00d8-46c9-aa88-e5acc5b370c2', 'Écran Dell UltraSharp 27" 4K USB-C Hub IPS Black', 1, 3833.33, 20, 3833.33, 1, NULL, ARRAY[]::text[]) ON CONFLICT DO NOTHING;

-- Tabla bon_retour_achats: (0 filas)

-- Tabla bon_retour_achat_lignes: (0 filas)

-- Tabla: ventes_pos (8 filas)
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('44f05671-e5cd-414b-93df-22020e3cffb9', 'POS-2026-0001', '2026-09-19', '2072028e-eb2f-4677-8851-37f0e98d877d', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 2267.5, 453.5, 2721, 'especes', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-19T15:29:03.454314+00:00', 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('8fa3ba89-c416-4f0e-8f52-a682522bdb7f', 'POS-2026-0002', '2026-09-19', '05ad72c0-cb32-41fd-91a0-487e1d40ad9b', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 13983.33, 2796.67, 16780, 'carte', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-19T16:44:03.454314+00:00', 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('b789f7f9-7131-4d2b-a299-1db200665e8a', 'POS-2026-0003', '2026-09-19', 'cdf7817f-164d-4768-9451-f54d7d555d69', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 3741.67, 748.33, 4490, 'carte', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-19T17:59:03.454314+00:00', 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('e84f9d09-b1f8-4610-8a02-00a9aee00ac8', 'POS-2026-0004', '2026-09-18', 'd23dfbe5-f47f-4bb3-a011-d70c5062a7ac', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 1816.67, 363.33, 2180, 'especes', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-18T16:29:03.454314+00:00', 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('c0dcde68-1068-492a-9040-de46bfd11887', 'POS-2026-0005', '2026-09-18', 'fcd7d05b-49b2-47db-93eb-6dcbad607a56', 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 1530, 306, 1836, 'cheque', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-18T13:29:03.454314+00:00', 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('981894d5-18b4-4539-a5b7-502e6aff077f', 'POS-2026-0008', '2026-09-20', NULL, 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 23000, 0, 23000, 'especes', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-20T13:49:29.212364+00:00', 3157.6, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('33c2a78d-1a87-48d6-9411-20ac2c295096', 'POS-2026-0009', '2026-09-20', NULL, 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 22000, 0, 22000, 'especes', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-20T16:25:45.678929+00:00', 4157.6, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ventes_pos" ("id", "numero", "date", "client_id", "commercial_id", "tresorerie_id", "montant_ht", "montant_tva", "montant_ttc", "mode_paiement", "depot_id", "created_at", "remise", "inclure_tva") VALUES ('bbb51536-45e4-43de-a9db-1bd0ce18efd4', 'POS-2026-0010', '2026-09-20', NULL, 'f065eb02-d00e-4dcd-889f-73baac16b9b1', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 25774.8, 0, 25774.8, 'especes', '33763795-ec0a-4669-b59d-adc4fba7a4b7', '2026-09-20T16:28:47.983075+00:00', 0, FALSE) ON CONFLICT DO NOTHING;

-- Tabla: vente_pos_lignes (20 filas)
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('2c99826d-cd32-44b4-bccd-1f6e6a5b0639', '44f05671-e5cd-414b-93df-22020e3cffb9', 'f6a30a16-955a-4946-b62c-44ef297acfee', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', 1, 2241.67, 20, 2241.67, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('588a3447-4d48-4aa2-b2cf-2e8eb7ea471b', '44f05671-e5cd-414b-93df-22020e3cffb9', '3f083af1-13dd-4176-a1cc-9a3dd39285f2', 'Canette Red Bull Energy Drink 250ml', 1, 18.33, 20, 18.33, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('257e1297-56d3-4dd9-9537-16f1d5c5e0ef', '44f05671-e5cd-414b-93df-22020e3cffb9', '7be153ab-ac43-4e9f-a6b5-50353aa2e579', 'Bouteille Eau Minérale Naturelle Sidi Ali 1.5L', 2, 6, 0, 12, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('d5044dd8-7faa-45af-a601-6cac4c6eb0bf', '8fa3ba89-c416-4f0e-8f52-a682522bdb7f', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 1, 10415.83, 20, 10415.83, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('05983a65-a79b-4868-9443-90e289190a5a', '8fa3ba89-c416-4f0e-8f52-a682522bdb7f', 'f6a30a16-955a-4946-b62c-44ef297acfee', 'Apple AirPods Pro 2 avec Boîtier MagSafe USB-C', 1, 2241.67, 20, 2241.67, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('3e0f59a0-1f79-4514-8f0e-778b4f3924c7', '8fa3ba89-c416-4f0e-8f52-a682522bdb7f', '802162f6-51b3-48c2-9d86-86be6748c870', 'Chargeur Secteur Rapide GaN Anker 65W 3 Ports USB-C', 2, 374.17, 20, 748.33, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('b11b876c-33dc-401a-94eb-3125f4265c8f', '8fa3ba89-c416-4f0e-8f52-a682522bdb7f', '74e42732-de59-4ed5-b0ac-625705b3f01c', 'Câble Tressé USB-C vers USB-C 100W 2 Mètres Noir', 4, 140.83, 20, 563.33, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('7acf4a71-6a5b-42e0-b81a-d97599830438', 'b789f7f9-7131-4d2b-a299-1db200665e8a', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', 'Apple Watch Series 9 GPS 45mm Minuit', 1, 3741.67, 20, 3741.67, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('296d32a2-d509-413d-bb61-e8c0e34d10e9', 'e84f9d09-b1f8-4610-8a02-00a9aee00ac8', '1db94d4d-8e6e-421d-a639-deb8e70276ee', 'Clavier Logitech MX Keys S Sans Fil Graphite', 1, 991.67, 20, 991.67, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('282bf571-8384-41e9-a6a9-897fd96cf7fb', 'e84f9d09-b1f8-4610-8a02-00a9aee00ac8', '722fb419-99ba-4d01-a3bc-1690666aea6f', 'Souris Ergonomique Logitech MX Master 3S', 1, 825, 20, 825, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('8aaa3ce1-e6bf-477a-8ed9-8c126bf04efd', 'c0dcde68-1068-492a-9040-de46bfd11887', 'e20c6a90-79b4-49d2-af85-83b3749b9b1e', 'Boîte de 10 Capsules Nespresso Master Origin Colombia', 15, 56.67, 20, 850, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('192a9c8a-080c-4db0-a433-d0c5ce17a586', 'c0dcde68-1068-492a-9040-de46bfd11887', '52278f9f-9b8c-4208-884f-7d68a2397ff2', 'Pack 6 Canettes Coca-Cola Original Taste 33cl', 10, 30, 20, 300, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('022b73be-36ea-4b19-a015-f124c9077363', 'c0dcde68-1068-492a-9040-de46bfd11887', '3f083af1-13dd-4176-a1cc-9a3dd39285f2', 'Canette Red Bull Energy Drink 250ml', 20, 18.33, 20, 366.67, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('5d33e563-9f93-417b-bf20-7c61a32aba08', 'c0dcde68-1068-492a-9040-de46bfd11887', '7be153ab-ac43-4e9f-a6b5-50353aa2e579', 'Bouteille Eau Minérale Naturelle Sidi Ali 1.5L', 10, 6, 0, 60, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('8a005356-34b3-40ea-98e1-2580c4bc5ff3', '981894d5-18b4-4539-a5b7-502e6aff077f', 'b60eff83-b334-4f90-9355-750b395ab502', 'Apple iPhone 15 128GB Bleu Pastel', 1, 8176.48, 0, 8176.48, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('1d58c236-4422-450d-8d1e-23aa4b5c418f', '981894d5-18b4-4539-a5b7-502e6aff077f', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 1, 14823.52, 0, 14823.52, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('8ec5e435-441c-41c1-8b2e-834b96928b04', '33c2a78d-1a87-48d6-9411-20ac2c295096', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 1, 10512.36, 0, 10512.36, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('e03cb1d5-2a4d-4562-ba02-5a569010d81d', '33c2a78d-1a87-48d6-9411-20ac2c295096', 'b60eff83-b334-4f90-9355-750b395ab502', 'Apple iPhone 15 128GB Bleu Pastel', 1, 11487.64, 0, 11487.64, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('e49f847b-de2e-4186-ae7f-691901bafa5b', 'bbb51536-45e4-43de-a9db-1bd0ce18efd4', '84923b32-43a8-4048-89af-3c8f5fefbe21', 'Apple iPhone 15 Pro 128GB Titane Naturel', 1, 12499, 0, 12499, ARRAY[]::text[]) ON CONFLICT DO NOTHING;
INSERT INTO public."vente_pos_lignes" ("id", "vente_pos_id", "article_id", "designation", "quantite", "prix_unitaire", "tva", "montant_ht", "codes_articles") VALUES ('d51aec45-9205-44d1-abc7-b4f8e0434935', 'bbb51536-45e4-43de-a9db-1bd0ce18efd4', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', 'Apple Watch Series 9 GPS 45mm Minuit', 2, 6637.9, 0, 13275.8, ARRAY[]::text[]) ON CONFLICT DO NOTHING;

-- Tabla: paiements (8 filas)
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('5cfb6ead-3ea6-4fa0-81b2-ca94d92df601', '2026-09-19', 2721, 'especes', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', '44f05671-e5cd-414b-93df-22020e3cffb9', 'Encaissement Vente POS N° POS-2026-0001', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('e7a1e8c9-ebe1-4915-8775-1db2f1483616', '2026-09-19', 16780, 'carte', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', '8fa3ba89-c416-4f0e-8f52-a682522bdb7f', 'Encaissement Vente POS N° POS-2026-0002', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('67dc18f6-8a18-4977-9f39-84e785033071', '2026-09-19', 4490, 'carte', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', 'b789f7f9-7131-4d2b-a299-1db200665e8a', 'Encaissement Vente POS N° POS-2026-0003', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('c91452f7-1015-4f00-90d4-d0f16e47673b', '2026-09-18', 2180, 'especes', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', 'e84f9d09-b1f8-4610-8a02-00a9aee00ac8', 'Encaissement Vente POS N° POS-2026-0004', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('ac69a126-aa8b-4d2c-8952-d064dc8f995c', '2026-09-18', 1836, 'cheque', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'vente_pos', 'c0dcde68-1068-492a-9040-de46bfd11887', 'Encaissement Vente POS N° POS-2026-0005', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('1a5e2381-ffbb-4549-b205-342c7ef683b4', '2026-09-20', 23000, 'especes', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', '981894d5-18b4-4539-a5b7-502e6aff077f', 'Encaissement Vente POS N° POS-2026-0008', '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('887afbce-461e-44f9-9e68-bdfe2a573c6d', '2026-09-20', 22000, 'especes', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'vente_pos', '33c2a78d-1a87-48d6-9411-20ac2c295096', 'Encaissement Vente POS N° POS-2026-0009', '2026-09-20T16:25:45.678929+00:00', '2026-09-20T16:25:45.678929+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;
INSERT INTO public."paiements" ("id", "date", "montant", "mode_paiement", "tresorerie_id", "reference_type", "reference_id", "note", "created_at", "updated_at", "date_echeance", "reference_paiement", "statut_versement") VALUES ('8c651cf8-563a-4191-9b41-e0c0d02d9aa1', '2026-09-20', 25774.8, 'especes', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'vente_pos', 'bbb51536-45e4-43de-a9db-1bd0ce18efd4', 'Encaissement Vente POS N° POS-2026-0010', '2026-09-20T16:28:47.983075+00:00', '2026-09-20T16:28:47.983075+00:00', NULL, NULL, 'encaisse') ON CONFLICT DO NOTHING;

-- Tabla depenses: (0 filas)

-- Tabla: mouvements_tresorerie (10 filas)
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('d4dec8ba-630f-4c58-9a5e-e514da40b896', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 1500, 'Fond de caisse initial', 'autre', NULL, '2026-09-19T08:29:03.454314+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('55dddf26-0caf-42a2-b942-450a98bee436', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'sortie', 120, 'Achat fournitures d''entretien', 'depense', NULL, '2026-09-19T16:29:03.454314+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('b1700a96-e8bb-461c-a685-51675e88f42d', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 2721, 'Règlement vente_pos', 'paiement', '5cfb6ead-3ea6-4fa0-81b2-ca94d92df601', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('494e542d-1f1d-4f59-acbd-b6011aff8ae1', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 16780, 'Règlement vente_pos', 'paiement', 'e7a1e8c9-ebe1-4915-8775-1db2f1483616', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('9df9e29f-3052-4e0a-9813-6174cf94032f', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 4490, 'Règlement vente_pos', 'paiement', '67dc18f6-8a18-4977-9f39-84e785033071', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('18958f7a-ae92-4404-83ca-ea5b99bdf477', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 2180, 'Règlement vente_pos', 'paiement', 'c91452f7-1015-4f00-90d4-d0f16e47673b', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('f5566e78-0b75-4b60-b847-6cc855f7e341', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'entree', 1836, 'Règlement vente_pos', 'paiement', 'ac69a126-aa8b-4d2c-8952-d064dc8f995c', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('2bcbff9e-b18f-426e-a50a-394e3a30a29e', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 23000, 'Règlement vente_pos', 'paiement', '1a5e2381-ffbb-4549-b205-342c7ef683b4', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('ee55af51-af5c-4f35-aeb4-87e379fd97e2', '5f9ecd13-99a2-4219-9f12-f2215dd2fc84', 'entree', 22000, 'Règlement vente_pos', 'paiement', '887afbce-461e-44f9-9e68-bdfe2a573c6d', '2026-09-20T16:25:45.678929+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_tresorerie" ("id", "tresorerie_id", "type", "montant", "libelle", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('be786654-871a-4770-89a8-4e9fb9d73ed1', '1f8a66eb-e83e-4469-81b9-d930abfcd303', 'entree', 25774.8, 'Règlement vente_pos', 'paiement', '8c651cf8-563a-4191-9b41-e0c0d02d9aa1', '2026-09-20T16:28:47.983075+00:00', FALSE) ON CONFLICT DO NOTHING;

-- Tabla: mouvements_stock (4 filas)
INSERT INTO public."mouvements_stock" ("id", "article_id", "depot_id", "type", "quantite", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('5396d28d-701f-4017-9080-555e8deea927', '84923b32-43a8-4048-89af-3c8f5fefbe21', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'sortie', 1, 'vente_pos', '33c2a78d-1a87-48d6-9411-20ac2c295096', '2026-09-20T16:25:45.96128+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_stock" ("id", "article_id", "depot_id", "type", "quantite", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('4e256ca3-1ca0-499a-9174-c111d7123681', 'b60eff83-b334-4f90-9355-750b395ab502', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'sortie', 1, 'vente_pos', '33c2a78d-1a87-48d6-9411-20ac2c295096', '2026-09-20T16:25:45.96128+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_stock" ("id", "article_id", "depot_id", "type", "quantite", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('0da9cb82-69f7-4341-9cd0-15ce51f7cdd0', '84923b32-43a8-4048-89af-3c8f5fefbe21', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'sortie', 1, 'vente_pos', 'bbb51536-45e4-43de-a9db-1bd0ce18efd4', '2026-09-20T16:28:48.150407+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."mouvements_stock" ("id", "article_id", "depot_id", "type", "quantite", "reference_type", "reference_id", "created_at", "inclure_tva") VALUES ('49f87522-aeda-4917-acdc-a0ae6449e5ea', '65cbd82d-f05e-4b01-b1d3-1bd985e2efa4', '33763795-ec0a-4669-b59d-adc4fba7a4b7', 'sortie', 2, 'vente_pos', 'bbb51536-45e4-43de-a9db-1bd0ce18efd4', '2026-09-20T16:28:48.150407+00:00', FALSE) ON CONFLICT DO NOTHING;

-- Tabla: plan_comptable (13 filas)
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('9abb72d6-0e84-4e14-a3c3-06cee4a9a0dc', '3421', 'Clients', 3, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('0489a729-290d-4182-bcdc-609d854f4d47', '3425', 'Clients - Retenues de garantie', 3, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('e1d261e9-7b39-4e37-b320-a9cff3032898', '3455', 'État - TVA récupérable', 3, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('de6e61a1-db71-406b-bf70-fc959e60bb1a', '4411', 'Fournisseurs', 4, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('93229d41-a771-4f84-825d-7783d1b81e05', '4455', 'État - TVA facturée', 4, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('6a16319f-16d8-43de-89b5-77c3055148a9', '4456', 'État - TVA due', 4, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('a04ec2aa-04ee-4e22-9bf6-0b1ec412280b', '5141', 'Banques (soldes débiteurs)', 5, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('696c82bd-e67f-49a6-8896-68628e8a2e39', '5161', 'Caisses', 5, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('a3e38dd7-4294-49d5-bba9-37f018805153', '6111', 'Achats de marchandises', 6, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('769cbb61-80b6-48ee-a114-bd28962abbcf', '6114', 'Variation des stocks de marchandises', 6, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('6ee6e5c3-d102-427c-9756-5106bfedf181', '6121', 'Achats de matières premières', 6, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('de4f45b6-7a76-4a53-82cd-aaa6f8dc980b', '7111', 'Ventes de marchandises', 7, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."plan_comptable" ("id", "compte", "libelle", "classe", "parent_id", "actif", "created_at", "updated_at") VALUES ('5634da08-3387-4804-9b96-d6de7fab8b0a', '7121', 'Ventes de biens et services produits', 7, NULL, TRUE, '2026-09-18T14:21:00.327722+00:00', '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;

-- Tabla: journaux (6 filas)
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('66889aae-9c3c-4e52-8f9a-62043968c6f4', 'ACH', 'Achats', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('7e593f94-10c1-428a-9056-24f7d505ebd5', 'VTE', 'Ventes', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('d936d7e9-a5cf-4b8e-af3e-88c6de44d322', 'BNQ', 'Banque', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('977e9988-2c93-48b8-9c17-e79a972e4469', 'CAI', 'Caisse', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('6e82ab02-7be5-446b-a55f-0a33541b7dbf', 'OD', 'Opérations Diverses', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."journaux" ("id", "code", "libelle", "actif", "created_at") VALUES ('03ecb0c2-4332-450b-8f3e-fa5087757b4c', 'AN', 'À Nouveaux', TRUE, '2026-09-18T14:21:00.327722+00:00') ON CONFLICT DO NOTHING;

-- Tabla: ecritures_comptables (8 filas)
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('f96a6f81-5ed6-4fb9-9d70-78cf856c986d', '2026-09-19', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', '5cfb6ead-3ea6-4fa0-81b2-ca94d92df601', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('d0c7431b-4513-4c2d-98fa-45d72ebc692e', '2026-09-19', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', 'e7a1e8c9-ebe1-4915-8775-1db2f1483616', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('c2355039-da0f-4920-8297-8f42508758c9', '2026-09-19', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', '67dc18f6-8a18-4977-9f39-84e785033071', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('3c7b4d40-04f0-45da-a7a0-09cec5218a0a', '2026-09-18', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', 'c91452f7-1015-4f00-90d4-d0f16e47673b', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('cf1b94f2-2b32-4030-85bd-44f6f05b1714', '2026-09-18', 'd936d7e9-a5cf-4b8e-af3e-88c6de44d322', 'Règlement vente_pos', 'paiement', 'ac69a126-aa8b-4d2c-8952-d064dc8f995c', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('21a38b1a-6654-4c00-a59b-a88696896ace', '2026-09-20', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', '1a5e2381-ffbb-4549-b205-342c7ef683b4', 'valide', NULL, '2026-09-20T15:23:11.132083+00:00', '2026-09-20T15:23:11.132083+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('8d20d67c-4f4a-4015-8db0-c4e68ded6cc1', '2026-09-20', '977e9988-2c93-48b8-9c17-e79a972e4469', 'Règlement vente_pos', 'paiement', '887afbce-461e-44f9-9e68-bdfe2a573c6d', 'valide', NULL, '2026-09-20T16:25:45.678929+00:00', '2026-09-20T16:25:45.678929+00:00', FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."ecritures_comptables" ("id", "date", "journal_id", "libelle", "reference_type", "reference_id", "statut", "created_by", "created_at", "updated_at", "inclure_tva") VALUES ('ced8d815-6724-4e4d-939f-b5ad0487a73f', '2026-09-20', 'd936d7e9-a5cf-4b8e-af3e-88c6de44d322', 'Règlement vente_pos', 'paiement', '8c651cf8-563a-4191-9b41-e0c0d02d9aa1', 'valide', NULL, '2026-09-20T16:28:47.983075+00:00', '2026-09-20T16:28:47.983075+00:00', FALSE) ON CONFLICT DO NOTHING;

-- Tabla: lignes_ecriture (16 filas)
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('17cd7331-2925-4397-8089-93c17d4a2d60', 'f96a6f81-5ed6-4fb9-9d70-78cf856c986d', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 2721, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('317fe376-496b-40e7-842c-129a7a47d87a', 'f96a6f81-5ed6-4fb9-9d70-78cf856c986d', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 2721, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('b534e090-b78e-4dba-9a6a-efb41062bb4e', 'd0c7431b-4513-4c2d-98fa-45d72ebc692e', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 16780, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('33e4951f-77bc-45b1-aa17-2eaf0dbc4542', 'd0c7431b-4513-4c2d-98fa-45d72ebc692e', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 16780, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('9c94b33a-7b87-4d50-90a6-5261fba72690', 'c2355039-da0f-4920-8297-8f42508758c9', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 4490, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('5b1b8d9e-d8e8-4505-9062-ab390461ae75', 'c2355039-da0f-4920-8297-8f42508758c9', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 4490, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('baa3b4f5-5395-45ab-b41b-2f02b03b5618', '3c7b4d40-04f0-45da-a7a0-09cec5218a0a', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 2180, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('8d600f7d-d881-4e3f-a817-3c7b23a978a8', '3c7b4d40-04f0-45da-a7a0-09cec5218a0a', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 2180, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('96ac1bbd-6d97-4840-8888-5745b80a3650', 'cf1b94f2-2b32-4030-85bd-44f6f05b1714', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 1836, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('a7f76c4f-ba20-4488-a9c3-c97277a29cbe', 'cf1b94f2-2b32-4030-85bd-44f6f05b1714', 'a04ec2aa-04ee-4e22-9bf6-0b1ec412280b', NULL, 0, 1836, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('4f0b4444-b0d1-4837-95e4-afc854899880', '21a38b1a-6654-4c00-a59b-a88696896ace', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 23000, 0, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('9f8b557a-45fc-40b1-a4c0-ace8c0219708', '21a38b1a-6654-4c00-a59b-a88696896ace', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 23000, 0, '2026-09-20T15:23:11.132083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('ed511c69-5c2c-487c-ab7d-f0ec68d1e2bb', '8d20d67c-4f4a-4015-8db0-c4e68ded6cc1', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 22000, 0, 0, '2026-09-20T16:25:45.678929+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('7a2db86d-d6d0-412d-a063-cf1cf3315b04', '8d20d67c-4f4a-4015-8db0-c4e68ded6cc1', '696c82bd-e67f-49a6-8896-68628e8a2e39', NULL, 0, 22000, 0, '2026-09-20T16:25:45.678929+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('c8f9d471-a963-430c-86de-625dd4b2afde', 'ced8d815-6724-4e4d-939f-b5ad0487a73f', 'de6e61a1-db71-406b-bf70-fc959e60bb1a', NULL, 25774.8, 0, 0, '2026-09-20T16:28:47.983075+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."lignes_ecriture" ("id", "ecriture_id", "compte_id", "libelle", "debit", "credit", "ordre", "created_at") VALUES ('5b2c1a95-5d6b-4f67-a36a-7e19eb0f7712', 'ced8d815-6724-4e4d-939f-b5ad0487a73f', 'a04ec2aa-04ee-4e22-9bf6-0b1ec412280b', NULL, 0, 25774.8, 0, '2026-09-20T16:28:47.983075+00:00') ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 5. REACTIVAR TRIGGERS Y CONSTRAINTS NORMALES
-- ==========================================================================
SET session_replication_role = 'origin';

-- ==========================================================================
-- 6. PERMISOS Y ROLES POSTGRES
-- ==========================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

