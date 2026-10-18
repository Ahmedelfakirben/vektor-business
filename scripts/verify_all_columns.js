const fs = require('fs');
const path = require('path');

const dataSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', '02_datos_completos.sql'), 'utf8');
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', '01_esquema_completo.sql'), 'utf8');

// Find all unique tables and their columns in INSERT statements
const tableCols = {};
const regex = /INSERT INTO public\."(\w+)"\s*\(([^)]+)\)/g;
let match;
while ((match = regex.exec(dataSql)) !== null) {
  const table = match[1];
  const cols = match[2].split(',').map(c => c.trim().replace(/"/g, ''));
  if (!tableCols[table]) {
    tableCols[table] = new Set(cols);
  } else {
    cols.forEach(c => tableCols[table].add(c));
  }
}

// Parse all columns defined per table in schemaSql
// 1. CREATE TABLE table_name ( ... );
// 2. ALTER TABLE table_name ADD COLUMN [IF NOT EXISTS] col_name ...
const schemaTableCols = {};

// Handle CREATE TABLE
const createRegex = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi;
let cMatch;
while ((cMatch = createRegex.exec(schemaSql)) !== null) {
  const table = cMatch[1].toLowerCase();
  const body = cMatch[2];
  if (!schemaTableCols[table]) schemaTableCols[table] = new Set();
  
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/--.*$/, '');
    if (!trimmed || trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY') || trimmed.startsWith('UNIQUE') || trimmed.startsWith('CHECK')) continue;
    const colName = trimmed.split(/\s+/)[0].replace(/"/g, '').toLowerCase();
    if (colName) schemaTableCols[table].add(colName);
  }
}

// Handle ALTER TABLE ... ADD COLUMN
const alterRegex = /ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi;
let aMatch;
while ((aMatch = alterRegex.exec(schemaSql)) !== null) {
  const table = aMatch[1].toLowerCase();
  const col = aMatch[2].toLowerCase();
  if (!schemaTableCols[table]) schemaTableCols[table] = new Set();
  schemaTableCols[table].add(col);
}

console.log('--- STRICT PER-TABLE COLUMN AUDIT ---');
let missing = 0;
for (const [table, cols] of Object.entries(tableCols)) {
  const defined = schemaTableCols[table.toLowerCase()] || new Set();
  for (const col of cols) {
    if (!defined.has(col.toLowerCase())) {
      console.log(`[MISSING] Table "${table}" -> Column "${col}" is NOT defined in schema!`);
      missing++;
    }
  }
}

if (missing === 0) {
  console.log('SUCCESS: All inserted columns are strictly defined on their respective tables!');
} else {
  console.log(`Total missing: ${missing}`);
}
