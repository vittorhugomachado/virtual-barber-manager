-- Tornar customer_id, barber_id e service_id nullable
-- e configurar ON DELETE SET NULL para preservar o histórico de agendamentos

ALTER TABLE appointments ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN barber_id DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN service_id DROP NOT NULL;

-- Recriar FK de customer_id com SET NULL
ALTER TABLE appointments DROP CONSTRAINT appointments_customer_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Recriar FK de barber_id com SET NULL
ALTER TABLE appointments DROP CONSTRAINT appointments_barber_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_barber_id_fkey
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL;

-- Recriar FK de service_id com SET NULL
ALTER TABLE appointments DROP CONSTRAINT appointments_service_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
