-- Create a default depot if none exists
INSERT INTO depots (code, libelle, adresse)
VALUES ('DEP-001', 'Dépôt Principal', 'Siège Social')
ON CONFLICT (code) DO NOTHING;
