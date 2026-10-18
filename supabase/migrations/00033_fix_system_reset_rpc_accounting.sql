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
