const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const OLD_URL = 'https://ymwzzlopuyglvffzntny.supabase.co';
const OLD_SECRET = 'sb_secret_VICWP_agAn_KmU3AvJGM8w_7GPekpAI';

const oldClient = createClient(OLD_URL, OLD_SECRET);

async function downloadFiles() {
    const backupDir = path.join(__dirname, '..', 'supabase', 'storage_backup', 'articles');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('Listing files in bucket "articles"...');
    const { data: files, error } = await oldClient.storage.from('articles').list('', { limit: 100 });
    if (error) {
        console.error('Error listing files:', error);
        return;
    }

    console.log(`Found ${files.length} files. Downloading...`);

    for (const f of files) {
        if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
        const filePath = path.join(backupDir, f.name);
        console.log(`Downloading ${f.name} (${f.metadata?.size || 0} bytes)...`);
        const { data, error: dlErr } = await oldClient.storage.from('articles').download(f.name);
        if (dlErr) {
            console.error(`Error downloading ${f.name}:`, dlErr);
        } else {
            const buffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            console.log(`Saved ${f.name} (${buffer.length} bytes)`);
        }
    }

    console.log('All storage files successfully backed up locally!');
}

downloadFiles();
