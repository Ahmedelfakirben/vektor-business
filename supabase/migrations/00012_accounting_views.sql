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
