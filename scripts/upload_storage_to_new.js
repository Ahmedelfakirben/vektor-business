const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://api-khalid.elfakir.com';
const NEW_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTc0NjM0MCwiZXhwIjo0OTQ3NDE5OTQwLCJyb2xlIjoiYW5vbiJ9.zTAuR28zgIjrnpt-IZDAa7i0G-tdgIspqwyAUHqBduY';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    let client;
    if (SERVICE_KEY) {
        console.log('Using Service Role Key...');
        client = createClient(NEW_URL, SERVICE_KEY);
    } else {
        console.log('Using Anon Key and signing in as admin@khalid.com...');
        client = createClient(NEW_URL, NEW_ANON);
        const { data, error } = await client.auth.signInWithPassword({
            email: 'admin@khalid.com',
            password: 'Admin123456!'
        });
        if (error) {
            console.error('Sign in failed:', error.message);
            console.error('Please make sure you executed 01_esquema_completo.sql and 02_datos_completos.sql in Supabase Studio first.');
            return;
        }
        console.log('Signed in successfully as Admin!');
    }

    const backupDir = path.join(__dirname, '..', 'supabase', 'storage_backup', 'articles');
    if (!fs.existsSync(backupDir)) {
        console.error('No backup directory found at:', backupDir);
        return;
    }

    const files = fs.readdirSync(backupDir);
    console.log(`Found ${files.length} files to upload to bucket "articles"...`);

    for (const f of files) {
        const filePath = path.join(backupDir, f);
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(f).toLowerCase().replace('.', '');
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

        console.log(`Uploading ${f} (${buffer.length} bytes)...`);
        const { error: upErr } = await client.storage.from('articles').upload(f, buffer, {
            contentType,
            upsert: true
        });

        if (upErr) {
            console.error(`Upload error for ${f}:`, upErr.message);
        } else {
            console.log(`Uploaded ${f} successfully.`);
        }
    }

    console.log('Finished uploading all storage files to new Supabase!');
}

run();
