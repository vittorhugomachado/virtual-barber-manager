-- ============================================================
-- 01. ENUMS
-- ============================================================

CREATE TYPE "user_role" AS ENUM ('barbershop', 'barber', 'customer');

CREATE TYPE "appointment_status" AS ENUM (
  'scheduled',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_barbershop'
);

CREATE TYPE "brazilian_state" AS ENUM (
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
);