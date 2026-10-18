-- Enable RLS on paiements
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

-- Policy for Authenticated Users (Full Access)
CREATE POLICY "Enable all access for authenticated users" ON paiements
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Ensure triggers have permissions (if they weren't security definer, but they are)
-- Just in case, grant usage on sequence if any (uuid doesn't use sequence)

-- Check if associated tables allow access (just to be safe)
ALTER TABLE mouvements_tresorerie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON mouvements_tresorerie
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
