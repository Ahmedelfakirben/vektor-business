-- 1. Initialize sequences for master data if not exist
INSERT INTO sequences (type, prefixe, dernier_numero) 
VALUES 
  ('client', 'CLI', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM clients)),
  ('fournisseur', 'FRN', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM fournisseurs)),
  ('article', 'ART', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM articles)),
  ('famille_article', 'FAM', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM familles_articles)),
  ('depot', 'DEP', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM depots)),
  ('salarie', 'SAL', (SELECT COALESCE(MAX(CAST(substring(matricule from '\d+') AS INTEGER)), 0) FROM salaries)),
  ('tresorerie', 'TRS', (SELECT COALESCE(MAX(CAST(substring(code from '\d+') AS INTEGER)), 0) FROM tresoreries))
ON CONFLICT (type) DO UPDATE SET prefixe = EXCLUDED.prefixe;

-- 2. Update next_numero to handle master data format (CLI00001) vs documents (BL-YYYY-0001)
CREATE OR REPLACE FUNCTION next_numero(p_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq sequences%ROWTYPE;
  v_numero VARCHAR;
BEGIN
  UPDATE sequences
  SET dernier_numero = dernier_numero + 1
  WHERE type = p_type
  RETURNING * INTO v_seq;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sequence type % not found', p_type;
  END IF;

  -- Master data format: PREFIX00001 (sin año)
  IF p_type IN ('client', 'fournisseur', 'article', 'famille_article', 'depot', 'salarie', 'tresorerie') THEN
    v_numero := v_seq.prefixe || LPAD(v_seq.dernier_numero::TEXT, 5, '0');
  ELSE
    -- Documents format: PREFIX-YYYY-0001 (con año)
    v_numero := v_seq.prefixe || '-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(v_seq.dernier_numero::TEXT, 4, '0');
  END IF;
  
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- 3. Update the trigger function to use next_numero (safety net for direct SQL inserts)
CREATE OR REPLACE FUNCTION generate_missing_code()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'salaries' THEN
    IF NEW.matricule IS NULL OR NEW.matricule = '' THEN
      NEW.matricule := next_numero('salarie');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  -- Use next_numero based on table name
  IF TG_TABLE_NAME = 'clients' THEN NEW.code := next_numero('client');
  ELSIF TG_TABLE_NAME = 'fournisseurs' THEN NEW.code := next_numero('fournisseur');
  ELSIF TG_TABLE_NAME = 'articles' THEN NEW.code := next_numero('article');
  ELSIF TG_TABLE_NAME = 'familles_articles' THEN NEW.code := next_numero('famille_article');
  ELSIF TG_TABLE_NAME = 'depots' THEN NEW.code := next_numero('depot');
  ELSIF TG_TABLE_NAME = 'tresoreries' THEN NEW.code := next_numero('tresorerie');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
