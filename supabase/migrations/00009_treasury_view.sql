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
