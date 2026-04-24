-- =======================================================
-- SmokeStudio R2 - Políticas de Seguridad (RLS) y RPC
-- Ejecutar en: Supabase > SQL Editor
-- =======================================================

-- 1. Asegurar que RLS esté habilitado en las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas anteriores (opcional, para evitar conflictos)
DROP POLICY IF EXISTS "service role can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios datos" ON public.users;
DROP POLICY IF EXISTS "Usuarios pueden crear sus propios analisis" ON public.analyses;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios analisis" ON public.analyses;

-- ==========================================
-- POLÍTICAS PARA LA TABLA: users
-- ==========================================
-- Los usuarios autenticados solo pueden ver su propia fila
CREATE POLICY "Users can view own data"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- NOTA: La actualización y creación de usuarios suele manejarse 
-- con Triggers de Auth, por lo que no damos permisos de UPDATE/INSERT directos.


-- ==========================================
-- POLÍTICAS PARA LA TABLA: analyses
-- ==========================================
-- Los usuarios solo pueden insertar análisis para sí mismos
CREATE POLICY "Users can insert own analyses"
ON public.analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Los usuarios solo pueden ver sus propios análisis
CREATE POLICY "Users can view own analyses"
ON public.analyses FOR SELECT
USING (auth.uid() = user_id);


-- ==========================================
-- POLÍTICAS PARA LA TABLA: leads
-- ==========================================
-- Cualquier persona (incluso anónimos) puede insertar un lead
CREATE POLICY "Anyone can insert a lead"
ON public.leads FOR INSERT
WITH CHECK (true);

-- NADIE puede hacer SELECT, UPDATE o DELETE desde el cliente público.
-- (Al no crear políticas para SELECT/UPDATE/DELETE, Supabase las bloquea por defecto)
-- Los administradores podrán verlos en el Dashboard o usando el Service Role Key.


-- ==========================================
-- RPC: Deducción segura de intentos
-- ==========================================
-- Esta función asegura que solo el propio usuario (o un admin) pueda descontar sus intentos
-- directamente en el servidor, evitando modificaciones maliciosas desde el JS.

CREATE OR REPLACE FUNCTION public.deduct_attempt(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos de administrador para saltar RLS si es necesario
AS $$
BEGIN
  -- Validar que el usuario autenticado sea el mismo que intenta descontar
  -- o permitir si es llamado por un rol de servicio interno
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'No autorizado para descontar intentos de otro usuario';
  END IF;

  UPDATE public.users 
  SET intentos_restantes = GREATEST(intentos_restantes - 1, 0)
  WHERE id = target_user_id;
END;
$$;
