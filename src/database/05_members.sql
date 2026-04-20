-- ============================================================
-- 05. SISTEMA DE MEMBROS POR BARBEARIA
-- Execute após o 04_rls.sql
-- ============================================================

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE "member_role" AS ENUM ('admin', 'reader');

-- ============================================================
-- TABELA
-- ============================================================

CREATE TABLE "barbershop_members" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id" UUID NOT NULL REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "user_id"       UUID NOT NULL UNIQUE REFERENCES "profiles"(id) ON DELETE CASCADE,
  "role"          "member_role" NOT NULL DEFAULT 'reader',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_member_per_barbershop UNIQUE (barbershop_id, user_id)
);

CREATE INDEX idx_members_barbershop ON "barbershop_members" ("barbershop_id");
CREATE INDEX idx_members_user       ON "barbershop_members" ("user_id");

-- ============================================================
-- FUNÇÃO AUXILIAR
-- Retorna o barbershop_id da barbearia à qual o usuário pertence
-- como membro. Usada pelo frontend para carregar a barbearia
-- correta ao logar como membro (não owner).
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_member_barbershop_id()
RETURNS UUID AS $$
  SELECT barbershop_id
  FROM "barbershop_members"
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- RPC: listar membros com nome e email
-- Retorna os membros da barbearia com dados do perfil e email.
-- Requer SECURITY DEFINER para acessar auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION get_barbershop_members(p_barbershop_id UUID)
RETURNS TABLE (
  id         UUID,
  user_id    UUID,
  role       member_role,
  name       TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "barbershops"
    WHERE id = p_barbershop_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para listar membros desta barbearia.';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.role,
    p.name,
    u.email::TEXT,
    m.created_at
  FROM "barbershop_members" m
  JOIN "profiles"   p ON p.id = m.user_id
  JOIN auth.users   u ON u.id = m.user_id
  WHERE m.barbershop_id = p_barbershop_id
  ORDER BY m.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: adicionar membro por email
-- O usuário já deve ter uma conta cadastrada no sistema.
-- ============================================================

CREATE OR REPLACE FUNCTION add_member_by_email(
  p_email         TEXT,
  p_role          member_role,
  p_barbershop_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id   UUID;
  v_member_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "barbershops"
    WHERE id = p_barbershop_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Apenas o dono da barbearia pode adicionar membros.';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com este email.';
  END IF;

  IF v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode adicionar a si mesmo como membro.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "barbershop_members"
    WHERE barbershop_id = p_barbershop_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Este usuário já é membro desta barbearia.';
  END IF;

  INSERT INTO "barbershop_members" (barbershop_id, user_id, role)
  VALUES (p_barbershop_id, v_user_id, p_role)
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RLS: barbershop_members
-- ============================================================

ALTER TABLE "barbershop_members" ENABLE ROW LEVEL SECURITY;

-- Owner gerencia todos os membros da sua barbearia
CREATE POLICY "owner can manage members"
  ON "barbershop_members" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- Membro visualiza seu próprio registro (necessário para o frontend
-- identificar a qual barbearia pertence e qual é o seu role)
CREATE POLICY "member can view own record"
  ON "barbershop_members" FOR SELECT USING (
    user_id = auth.uid()
  );

-- ============================================================
-- RLS ADICIONAL: appointments
-- Membros (admin e reader) têm acesso completo aos agendamentos.
-- A restrição de navegação fica no frontend (ProtectedRoute).
-- ============================================================

CREATE POLICY "member can manage appointments"
  ON "appointments" FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "barbershop_members"
      WHERE user_id       = auth.uid()
        AND barbershop_id = appointments.barbershop_id
    )
  );
