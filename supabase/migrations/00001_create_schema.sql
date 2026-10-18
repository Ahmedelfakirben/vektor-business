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
