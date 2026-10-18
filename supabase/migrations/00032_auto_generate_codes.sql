-- Función para generar códigos automáticos para Clientes y Artículos
CREATE OR REPLACE FUNCTION generate_missing_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  tbl TEXT;
  new_code TEXT;
  counter INT;
BEGIN
  -- Si ya tiene código, no hacemos nada
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  -- Determinar prefijo según tabla
  tbl := TG_TABLE_NAME;
  IF tbl = 'clients' THEN prefix := 'CLI-';
  ELSIF tbl = 'articles' THEN prefix := 'ART-';
  ELSIF tbl = 'fournisseurs' THEN prefix := 'FOR-';
  ELSE prefix := 'GEN-';
  END IF;

  -- Generar código único sencillo
  SELECT count(*) + 1 INTO counter FROM (SELECT 1 FROM clients UNION ALL SELECT 1 FROM articles UNION ALL SELECT 1 FROM fournisseurs) as total;
  new_code := prefix || LPAD(counter::TEXT, 5, '0');
  
  NEW.code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas principales
DROP TRIGGER IF EXISTS trg_auto_code_clients ON clients;
CREATE TRIGGER trg_auto_code_clients BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION generate_missing_code();

DROP TRIGGER IF EXISTS trg_auto_code_articles ON articles;
CREATE TRIGGER trg_auto_code_articles BEFORE INSERT ON articles FOR EACH ROW EXECUTE FUNCTION generate_missing_code();

DROP TRIGGER IF EXISTS trg_auto_code_fournisseurs ON fournisseurs;
CREATE TRIGGER trg_auto_code_fournisseurs BEFORE INSERT ON fournisseurs FOR EACH ROW EXECUTE FUNCTION generate_missing_code();
