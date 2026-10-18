-- recalculate_stock.sql
-- Use this script to fix historical data errors caused by the previous double-counting bug.

BEGIN;

-- 1. Reset all stock balances
DELETE FROM public.stock;

-- 2. Rebuild stock balances from movements log
-- The Movements log represents the truth of every transaction.
INSERT INTO public.stock (article_id, depot_id, quantite, quantite_fiscale)
SELECT 
    article_id, 
    depot_id, 
    SUM(CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) as quantite,
    SUM(CASE WHEN inclure_tva = true THEN (CASE WHEN type = 'entree' THEN quantite ELSE -quantite END) ELSE 0 END) as quantite_fiscale
FROM public.mouvements_stock
GROUP BY article_id, depot_id
ON CONFLICT (article_id, depot_id) DO UPDATE SET
    quantite = EXCLUDED.quantite,
    quantite_fiscale = EXCLUDED.quantite_fiscale;

COMMIT;

-- Verification query:
SELECT * FROM public.stock LIMIT 10;
