-- ============================================================
-- 04. ROW LEVEL SECURITY (RLS)
-- Execute após o 03_triggers.sql
-- ============================================================

ALTER TABLE "profiles"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "barbershops"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addresses"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "barbers"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_barbers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opening_hours"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments"    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "user can view own profile"
  ON "profiles" FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user can update own profile"
  ON "profiles" FOR UPDATE USING (auth.uid() = id);

-- BARBERSHOPS
CREATE POLICY "barbershops are public"
  ON "barbershops" FOR SELECT USING (is_active = TRUE);

CREATE POLICY "owner can manage own barbershop"
  ON "barbershops" FOR ALL USING (auth.uid() = owner_id);

-- ADDRESSES
CREATE POLICY "addresses are public"
  ON "addresses" FOR SELECT USING (TRUE);

CREATE POLICY "owner can manage own address"
  ON "addresses" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- BARBERS
CREATE POLICY "barbers are public"
  ON "barbers" FOR SELECT USING (is_active = TRUE);

CREATE POLICY "owner can manage barbers"
  ON "barbers" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- SERVICES
CREATE POLICY "services are public"
  ON "services" FOR SELECT USING (is_active = TRUE);

CREATE POLICY "owner can manage services"
  ON "services" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- SERVICE_BARBERS
CREATE POLICY "service_barbers are public"
  ON "service_barbers" FOR SELECT USING (TRUE);

CREATE POLICY "owner can manage service_barbers"
  ON "service_barbers" FOR ALL USING (
    auth.uid() = (
      SELECT b.owner_id FROM "barbershops" b
      JOIN "services" s ON s.barbershop_id = b.id
      WHERE s.id = service_id
    )
  );

-- OPENING_HOURS
CREATE POLICY "opening_hours are public"
  ON "opening_hours" FOR SELECT USING (TRUE);

CREATE POLICY "owner can manage opening_hours"
  ON "opening_hours" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- CUSTOMERS
CREATE POLICY "customer can view own data"
  ON "customers" FOR SELECT USING (auth.uid() = id);

CREATE POLICY "owner can view customers of own barbershop"
  ON "customers" FOR SELECT USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );

-- APPOINTMENTS
CREATE POLICY "customer can view own appointments"
  ON "appointments" FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "customer can create appointment"
  ON "appointments" FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "customer can cancel own appointment"
  ON "appointments" FOR UPDATE USING (auth.uid() = customer_id);

CREATE POLICY "barber can view own appointments"
  ON "appointments" FOR SELECT USING (auth.uid() = barber_id);

CREATE POLICY "owner can manage all appointments"
  ON "appointments" FOR ALL USING (
    auth.uid() = (SELECT owner_id FROM "barbershops" WHERE id = barbershop_id)
  );