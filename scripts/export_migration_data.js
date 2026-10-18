const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const OLD_URL = 'https://ymwzzlopuyglvffzntny.supabase.co';
const OLD_SECRET = 'sb_secret_VICWP_agAn_KmU3AvJGM8w_7GPekpAI';

const client = createClient(OLD_URL, OLD_SECRET);

const BACKUP_TABLES = [
    'profiles',
    'tresoreries',
    'depots',
    'salaries',
    'clients',
    'fournisseurs',
    'familles_articles',
    'sous_familles_articles',
    'articles',
    'sequences',
    'stock',
    'devis',
    'devis_lignes',
    'bon_commandes',
    'bon_commande_lignes',
    'bon_achats',
    'bon_achat_lignes',
    'bon_livraisons',
    'bon_livraison_lignes',
    'bon_retours',
    'bon_retour_lignes',
    'bon_retour_achats',
    'bon_retour_achat_lignes',
    'ventes_pos',
    'vente_pos_lignes',
    'paiements',
    'depenses',
    'mouvements_tresorerie',
    'mouvements_stock',
    'plan_comptable',
    'journaux',
    'ecritures_comptables',
    'lignes_ecriture'
];

function escapeSqlValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) {
        if (val.length === 0) return 'ARRAY[]::text[]';
        const items = val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
        return `ARRAY[${items}]::text[]`;
    }
    if (typeof val === 'object') {
        const json = JSON.stringify(val).replace(/'/g, "''");
        return `'${json}'::jsonb`;
    }
    // string
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
}

async function run() {
    console.log('Fetching auth user...');
    const { data: { users }, error: uErr } = await client.auth.admin.listUsers();
    if (uErr) console.error('Error fetching users:', uErr);
    const adminUser = users && users[0];

    let sql = `-- ==========================================================================\n`;
    sql += `-- MIGRATION COMPLETE DE DONNEES - ERP DIGITAL ALT\n`;
    sql += `-- Date: ${new Date().toISOString()}\n`;
    sql += `-- Source: Supabase Cloud (${OLD_URL})\n`;
    sql += `-- Target: Supabase Self-Hosted Ubuntu (Coolify)\n`;
    sql += `-- ==========================================================================\n\n`;

    sql += `-- 1. DESACTIVAR TRIGGERS Y CONSTRAINTS TEMPORALMENTE PARA IMPORTACION LIMPIA\n`;
    sql += `SET session_replication_role = 'replica';\n\n`;

    if (adminUser) {
        sql += `-- ==========================================================================\n`;
        sql += `-- 2. CREACION DEL USUARIO EN AUTH.USERS Y AUTH.IDENTITIES\n`;
        sql += `-- ==========================================================================\n`;
        sql += `CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`;
        sql += `INSERT INTO auth.users (\n`;
        sql += `  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,\n`;
        sql += `  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,\n`;
        sql += `  confirmation_token, recovery_token\n`;
        sql += `) VALUES (\n`;
        sql += `  '00000000-0000-0000-0000-000000000000',\n`;
        sql += `  '${adminUser.id}',\n`;
        sql += `  'authenticated',\n`;
        sql += `  'authenticated',\n`;
        sql += `  '${adminUser.email}',\n`;
        sql += `  crypt('Admin123456!', gen_salt('bf')),\n`;
        sql += `  NOW(),\n`;
        sql += `  '{"provider": "email", "providers": ["email"]}'::jsonb,\n`;
        sql += `  '${JSON.stringify(adminUser.user_metadata || {})}'::jsonb,\n`;
        sql += `  '${adminUser.created_at}',\n`;
        sql += `  NOW(),\n`;
        sql += `  '',\n`;
        sql += `  ''\n`;
        sql += `) ON CONFLICT (id) DO NOTHING;\n\n`;

        sql += `INSERT INTO auth.identities (\n`;
        sql += `  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at\n`;
        sql += `) VALUES (\n`;
        sql += `  '${adminUser.id}',\n`;
        sql += `  '${adminUser.id}',\n`;
        sql += `  jsonb_build_object('sub', '${adminUser.id}', 'email', '${adminUser.email}'),\n`;
        sql += `  'email',\n`;
        sql += `  '${adminUser.id}',\n`;
        sql += `  NOW(),\n`;
        sql += `  '${adminUser.created_at}',\n`;
        sql += `  NOW()\n`;
        sql += `) ON CONFLICT (id) DO NOTHING;\n\n`;
    }

    sql += `-- ==========================================================================\n`;
    sql += `-- 3. STORAGE BUCKET 'articles' (PUBLICO) Y POLICIES\n`;
    sql += `-- ==========================================================================\n`;
    sql += `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) \n`;
    sql += `VALUES ('articles', 'articles', true, 52428800, NULL) \n`;
    sql += `ON CONFLICT (id) DO UPDATE SET public = true;\n\n`;

    sql += `-- Politicas de Storage si no existen\n`;
    sql += `DO $$ BEGIN\n`;
    sql += `  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Articles') THEN\n`;
    sql += `    CREATE POLICY "Public Access Articles" ON storage.objects FOR SELECT USING (bucket_id = 'articles');\n`;
    sql += `  END IF;\n`;
    sql += `  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Upload Articles') THEN\n`;
    sql += `    CREATE POLICY "Authenticated Upload Articles" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'articles');\n`;
    sql += `  END IF;\n`;
    sql += `  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Update Articles') THEN\n`;
    sql += `    CREATE POLICY "Authenticated Update Articles" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'articles');\n`;
    sql += `  END IF;\n`;
    sql += `  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Delete Articles') THEN\n`;
    sql += `    CREATE POLICY "Authenticated Delete Articles" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'articles');\n`;
    sql += `  END IF;\n`;
    sql += `END $$;\n\n`;

    sql += `-- ==========================================================================\n`;
    sql += `-- 4. IMPORTACION DE DATOS EN TABLAS (EN ORDEN DE DEPENDENCIAS)\n`;
    sql += `-- ==========================================================================\n\n`;

    for (const table of BACKUP_TABLES) {
        console.log(`Fetching ${table}...`);
        const { data, error } = await client.from(table).select('*');
        if (error) {
            console.error(`Error on table ${table}:`, error);
            continue;
        }

        if (!data || data.length === 0) {
            sql += `-- Tabla ${table}: (0 filas)\n\n`;
            continue;
        }

        sql += `-- Tabla: ${table} (${data.length} filas)\n`;
        const columns = Object.keys(data[0]);
        const colList = columns.map(c => `"${c}"`).join(', ');

        for (const row of data) {
            const valList = columns.map(col => escapeSqlValue(row[col])).join(', ');
            sql += `INSERT INTO public."${table}" (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
        }
        sql += `\n`;
    }

    sql += `-- ==========================================================================\n`;
    sql += `-- 5. REACTIVAR TRIGGERS Y CONSTRAINTS NORMALES\n`;
    sql += `-- ==========================================================================\n`;
    sql += `SET session_replication_role = 'origin';\n\n`;

    sql += `-- ==========================================================================\n`;
    sql += `-- 6. PERMISOS Y ROLES POSTGRES\n`;
    sql += `-- ==========================================================================\n`;
    sql += `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;\n`;
    sql += `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;\n`;
    sql += `GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;\n\n`;

    const outPath = path.join(__dirname, '..', 'supabase', '02_datos_completos.sql');
    fs.writeFileSync(outPath, sql, 'utf8');
    console.log(`Successfully generated ${outPath}!`);
}

run();
