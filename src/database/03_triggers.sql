-- ============================================================
-- 03. TRIGGERS E FUNÇÕES
-- Execute após o 02_tables.sql
-- ============================================================

-- Função: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_barbershops_updated_at
  BEFORE UPDATE ON "barbershops"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON "addresses"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_barbers_updated_at
  BEFORE UPDATE ON "barbers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON "services"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função: previne conflito de agendamento por barbeiro
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "appointments"
    WHERE
      "barber_id" = NEW.barber_id
      AND "id" != NEW.id
      AND "status" NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      AND (
        NEW.starts_at < "ends_at"
        AND NEW.ends_at > "starts_at"
      )
  ) THEN
    RAISE EXCEPTION 'Conflito de agendamento: este barbeiro já possui um agendamento neste horário.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_appointment_conflict
  BEFORE INSERT OR UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION check_appointment_conflict();

-- ============================================================
-- Função: cria profile automaticamente após signup
--
-- IMPORTANTE: Esta função é criada aqui, mas o trigger que a
-- dispara (trg_create_profile) deve ser criado MANUALMENTE
-- pelo painel do Supabase em:
-- Database -> Triggers -> Add Trigger
--
-- Configuração do trigger:
--   Name:        trg_create_profile
--   Table:       users (schema: auth)
--   Events:      INSERT
--   Orientation: ROW
--   Timing:      AFTER
--   Function:    handle_new_user
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'barbershop')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Erro no handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;