# ERP Digital ALT - Khalid ERP & POS

Système ERP et Point de Vente (TPV / POS) complet avec gestion des stocks, trésorerie, devis, facturation, suivi fiscal et reconnaissance visuelle locale des articles.

## 🚀 Fonctionnalités Clés

- **Point de Vente (POS / TPV)** :
  - Vente rapide au comptoir, encaissements multi-modes (Espèces, Carte, Chèque, Virement).
  - **Reconnaissance Visuelle Locale** : identification instantanée (<20ms) des produits par caméra sans aucune IA externe ni frais d'API.
  - Scanner de codes-barres en direct.
  - Impression thermique de tickets de caisse, reçus de retour et rapports de clôture journalière.
  - Gestion des retours clients avec réintégration automatique en stock et remboursement trésorerie.
- **Catalogue & Master Data** :
  - Articles, Familles, Sous-familles.
  - Prise de photo directe par caméra web ou import d'image avec calcul automatique de l'empreinte visuelle.
  - Gestion des seuils d'alerte de stock.
- **Gestion des Stocks & Entrepôts** :
  - Multi-dépôts, mouvements d'entrées / sorties, inventaire en temps réel.
- **Documents Commerciaux** :
  - Bons de Commande, Bons de Livraison, Bons de Réception / Achat, Devis, Bons de Retour.
  - Génération de documents PDF professionnels.
- **Finance & Trésorerie** :
  - Suivi des caisses et comptes bancaires.
  - Mouvements de trésorerie, créances clients, dettes fournisseurs, régularisations.
  - Mode fiscal commutable (Déclaration officielle vs gestion interne).

---

## 🐳 Déploiement sur Coolify (Docker)

Le projet intègre un `Dockerfile` multi-stage optimisé pour Next.js (mode `standalone`) et Alpine Linux.

### 1. Ajouter l'application sur Coolify
1. Sur votre panneau Coolify, cliquez sur **+ New Resource** > **Public Repository**.
2. Renseignez l'URL du dépôt :
   ```
   https://github.com/Ahmedelfakirben/ERP-Khalid
   ```
3. Branche : `master`
4. Build Pack : **Dockerfile**
5. Port exposé : `3000`

### 2. Variables d'environnement (Coolify)

Dans l'onglet **Environment Variables** de Coolify, configurez les variables suivantes :

```env
# URL de votre instance Supabase (Ex: Coolify Kong API ou Supabase Cloud)
NEXT_PUBLIC_SUPABASE_URL=http://api-khalid.elfakir.com

# Clé anonyme (Anon Key) de Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key_ici

# Clé publique (Publishable Key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=votre_anon_key_ici

# Clé de rôle de service (optionnel, pour tâches admin)
# SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# IA Locale Ollama (optionnel)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

> **Astuce Coolify** : Assurez-vous de cocher l'option **"Build Variable"** pour `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Coolify afin que Next.js puisse pré-générer les routes statiques lors de l'étape de compilation Docker.

### 3. Lancer le déploiement
Cliquez sur **Deploy** dans Coolify. Coolify va :
1. Cloner le dépôt.
2. Installer les dépendances (`npm ci`).
3. Compiler le projet (`npm run build`).
4. Créer l'image ultra-légère et lancer le conteneur sur le port `3000`.

---

## 💻 Développement Local

```bash
# Installation des dépendances
npm install

# Copier le fichier d'exemple
cp .env.example .env.local

# Lancer le serveur de développement
npm run dev
```

Accédez à [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 🗄️ Base de Données (Supabase Postgres)

Les fichiers SQL complets pour initialiser ou migrer votre base de données se trouvent dans le dossier [`supabase/`](supabase/) :
- `supabase/01_esquema_completo.sql` : Schéma de tables, vues, triggers et fonctions RPC.
- `supabase/add_image_signature.sql` : Colonne pour l'empreinte visuelle des articles.
