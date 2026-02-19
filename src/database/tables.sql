-- ============================================================
-- 02. TABELAS
-- Execute após o 01_enums.sql
-- ============================================================

-- PROFILES (todos os usuários vinculados ao auth.users)
CREATE TABLE "profiles" (
  "id"         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "role"       "user_role" NOT NULL,
  "name"       TEXT,
  "phone"      TEXT UNIQUE,
  "avatar_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ
);

-- BARBERSHOPS
CREATE TABLE "barbershops" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"    UUID NOT NULL UNIQUE REFERENCES "profiles"(id) ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL UNIQUE,
  "email"       TEXT NOT NULL UNIQUE,
  "phone"       TEXT UNIQUE,
  "description" TEXT,
  "logo_url"    TEXT,
  "banner_url"  TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ
);

CREATE INDEX idx_barbershops_slug      ON "barbershops" ("slug");
CREATE INDEX idx_barbershops_is_active ON "barbershops" ("is_active");

-- ADDRESSES
CREATE TABLE "addresses" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id"  UUID NOT NULL UNIQUE REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "country"        TEXT NOT NULL DEFAULT 'Brasil',
  "state"          "brazilian_state" NOT NULL,
  "zip_code"       CHAR(8) NOT NULL,
  "neighborhood"   TEXT NOT NULL,
  "street"         TEXT NOT NULL,
  "number"         TEXT NOT NULL,
  "complement"     TEXT,
  "latitude"       FLOAT,
  "longitude"      FLOAT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ
);

-- BARBERS
CREATE TABLE "barbers" (
  "id"             UUID PRIMARY KEY REFERENCES "profiles"(id) ON DELETE CASCADE,
  "barbershop_id"  UUID NOT NULL REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "description"    TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ
);

CREATE INDEX idx_barbers_barbershop ON "barbers" ("barbershop_id");

-- SERVICES
CREATE TABLE "services" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id"  UUID NOT NULL REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "image_url"      TEXT,
  "duration_min"   INT NOT NULL,
  "price"          NUMERIC(10,2) NOT NULL,
  "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ
);

CREATE INDEX idx_services_barbershop ON "services" ("barbershop_id");

-- SERVICE_BARBERS (quais barbeiros realizam qual serviço)
CREATE TABLE "service_barbers" (
  "service_id" UUID NOT NULL REFERENCES "services"(id) ON DELETE CASCADE,
  "barber_id"  UUID NOT NULL REFERENCES "barbers"(id) ON DELETE CASCADE,

  PRIMARY KEY ("service_id", "barber_id")
);

-- OPENING_HOURS (horários com múltiplos intervalos por dia)
CREATE TABLE "opening_hours" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id" UUID NOT NULL REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "day_of_week"   SMALLINT NOT NULL CHECK ("day_of_week" BETWEEN 0 AND 6), -- 0=Dom ... 6=Sab
  "opens_at"      TIME NOT NULL,
  "closes_at"     TIME NOT NULL,

  CONSTRAINT chk_opening_hours_order CHECK ("opens_at" < "closes_at")
);

CREATE INDEX idx_opening_hours_barbershop ON "opening_hours" ("barbershop_id");

-- CUSTOMERS
CREATE TABLE "customers" (
  "id"            UUID PRIMARY KEY REFERENCES "profiles"(id) ON DELETE CASCADE,
  "barbershop_id" UUID NOT NULL REFERENCES "barbershops"(id) ON DELETE CASCADE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_barbershop ON "customers" ("barbershop_id");

-- APPOINTMENTS
CREATE TABLE "appointments" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id"  UUID NOT NULL REFERENCES "barbershops"(id),
  "customer_id"    UUID NOT NULL REFERENCES "customers"(id),
  "barber_id"      UUID NOT NULL REFERENCES "barbers"(id),
  "service_id"     UUID NOT NULL REFERENCES "services"(id),
  "notes"          TEXT,
  "status"         "appointment_status" NOT NULL DEFAULT 'scheduled',
  "starts_at"      TIMESTAMPTZ NOT NULL,
  "ends_at"        TIMESTAMPTZ NOT NULL,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ,

  CONSTRAINT chk_appointment_order CHECK ("starts_at" < "ends_at")
);

CREATE INDEX idx_appointments_barbershop ON "appointments" ("barbershop_id");
CREATE INDEX idx_appointments_barber     ON "appointments" ("barber_id");
CREATE INDEX idx_appointments_customer   ON "appointments" ("customer_id");
CREATE INDEX idx_appointments_starts_at  ON "appointments" ("starts_at");