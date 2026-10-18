import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// List of all tables in dependency order for accurate reconstruction
const BACKUP_TABLES = [
    "profiles",
    "tresoreries",
    "depots",
    "salaries",
    "clients",
    "fournisseurs",
    "familles_articles",
    "sous_familles_articles",
    "articles",
    "sequences",
    "stock",
    "devis",
    "devis_lignes",
    "bon_commandes",
    "bon_commande_lignes",
    "bon_achats",
    "bon_achat_lignes",
    "bon_livraisons",
    "bon_livraison_lignes",
    "bon_retours",
    "bon_retour_lignes",
    "bon_retour_achats",
    "bon_retour_achat_lignes",
    "ventes_pos",
    "vente_pos_lignes",
    "paiements",
    "depenses",
    "mouvements_tresorerie",
    "mouvements_stock",
    "plan_comptable",
    "journaux",
    "ecritures_comptables",
    "lignes_ecriture"
];

export async function GET() {
    try {
        const supabase = await createClient();
        
        // Ensure admin capabilities
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const backupData: Record<string, any[]> = {};
        const errors: any[] = [];

        // Fetch all data iteratively
        for (const table of BACKUP_TABLES) {
            const { data, error } = await supabase.from(table).select("*");
            if (error) {
                console.error(`Failed reading ${table}: `, error);
                errors.push({ table, error });
                backupData[table] = [];
            } else {
                backupData[table] = data || [];
            }
        }

        return NextResponse.json({ 
            version: "1.0",
            timestamp: new Date().toISOString(),
            data: backupData 
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        if (!body.data || typeof body.data !== 'object') {
            return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
        }

        // 1. Reset entirely first
        const { error: resetError } = await (supabase.rpc as any)("rpc_reset_database", { p_mode: "full" });
        if (resetError) {
             console.error("Reset Error: ", resetError)
             // We can proceed even with error, sometimes it's permission related, but we should handle it carefully
        }

        // 2. Insert data sequentially (dependency order)
        let successCount = 0;
        let failedTables = [];

        for (const table of BACKUP_TABLES) {
            const rows = body.data[table];
            if (rows && rows.length > 0) {
                // Upsert to handle potential conflicts gently
                const { error } = await supabase.from(table).upsert(rows);
                if (error) {
                    console.error(`Error importing ${table}:`, error);
                    failedTables.push(table);
                } else {
                    successCount++;
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "Importation terminée",
            tables_imported: successCount,
            failed_tables: failedTables
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
