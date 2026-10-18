-- ==========================================================================
-- FIX SUPABASE AUTH & USER REPAIR SCRIPT
-- ==========================================================================

-- 1. Arreglar columnas NULL en auth.users (GoTrue crasheaba porque Go no acepta NULL en strings)
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '');

-- 2. Asegurar que la contraseña de admin@khalid.com sea 'Admin123456!'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

UPDATE auth.users
SET 
  encrypted_password = crypt('Admin123456!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  aud = 'authenticated',
  role = 'authenticated'
WHERE email = 'admin@khalid.com';

-- 3. Arreglar el trigger handle_new_user (añadiendo search_path y control de excepciones)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nom, prenom, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'commercial'::public.user_role)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Evitar que un error en profiles bloquee la creación del usuario en Auth
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Permisos para que el servicio de autenticación de Supabase (GoTrue) pueda operar
GRANT USAGE ON SCHEMA public TO supabase_auth_admin, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin, anon, authenticated, service_role;
