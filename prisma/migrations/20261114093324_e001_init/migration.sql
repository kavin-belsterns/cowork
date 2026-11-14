-- CreateEnum
CREATE TYPE "role" AS ENUM ('platform_admin', 'office_admin', 'employee', 'receptionist');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "series_pattern" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "visit_status" AS ENUM ('expected', 'checked_in', 'checked_out', 'cancelled');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('created', 'changed', 'cancelled', 'removed', 'deactivated', 'checked_in', 'checked_out', 'anonymised', 'failed');

-- CreateEnum
CREATE TYPE "audit_entity_type" AS ENUM ('office', 'room', 'user', 'booking', 'series', 'visit', 'import', 'job');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('running', 'done');

-- CreateEnum
CREATE TYPE "job_name" AS ENUM ('purge_visitors', 'prune_sessions', 'prune_idempotency_keys', 'prune_sign_in_attempts');

-- CreateEnum
CREATE TYPE "job_result" AS ENUM ('running', 'ok', 'failed');

-- CreateTable
CREATE TABLE "offices" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_hours" (
    "office_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "opens_at" TIME(0) NOT NULL,
    "closes_at" TIME(0) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "office_hours_pkey" PRIMARY KEY ("office_id","weekday")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "office_id" UUID,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "phone" TEXT,
    "desk" TEXT,
    "password_hash" TEXT,
    "deactivated_at" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "temp_password_expires_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_in_attempts" (
    "id" UUID NOT NULL,
    "email_hash" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "series_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "attendees" INTEGER NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'confirmed',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_series" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "pattern" "series_pattern" NOT NULL,
    "until_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "booking_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "visit_date" DATE NOT NULL,
    "status" "visit_status" NOT NULL DEFAULT 'expected',
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_in_by" UUID,
    "checked_out_at" TIMESTAMPTZ(6),
    "host_seen_at" TIMESTAMPTZ(6),
    "anonymised_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "office_id" UUID,
    "actor_id" UUID,
    "action" "audit_action" NOT NULL,
    "entity_type" "audit_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "detail" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'running',
    "response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job" "job_name" NOT NULL,
    "run_date" DATE NOT NULL,
    "result" "job_result" NOT NULL DEFAULT 'running',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offices_name_key" ON "offices"("name");

-- CreateIndex
CREATE INDEX "rooms_office_size_idx" ON "rooms"("office_id", "size");

-- CreateIndex
CREATE INDEX "users_office_role_idx" ON "users"("office_id", "role");

-- CreateIndex
CREATE INDEX "sign_in_attempts_email_at_idx" ON "sign_in_attempts"("email_hash", "at");

-- CreateIndex
CREATE INDEX "sign_in_attempts_ip_at_idx" ON "sign_in_attempts"("ip", "at");

-- CreateIndex
CREATE INDEX "sessions_user_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "bookings_room_starts_idx" ON "bookings"("room_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_owner_starts_idx" ON "bookings"("owner_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_series_idx" ON "bookings"("series_id");

-- CreateIndex
CREATE INDEX "booking_series_owner_idx" ON "booking_series"("owner_id");

-- CreateIndex
CREATE INDEX "booking_series_room_idx" ON "booking_series"("room_id");

-- CreateIndex
CREATE INDEX "visits_office_date_idx" ON "visits"("office_id", "visit_date");

-- CreateIndex
CREATE INDEX "visits_host_date_idx" ON "visits"("host_id", "visit_date");

-- CreateIndex
CREATE INDEX "visits_checked_in_by_idx" ON "visits"("checked_in_by");

-- CreateIndex
CREATE INDEX "audit_events_office_at_idx" ON "audit_events"("office_id", "at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_events_at_idx" ON "audit_events"("at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_events_entity_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_scope_key_uq" ON "idempotency_keys"("user_id", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_job_date_uq" ON "job_runs"("job", "run_date");

-- AddForeignKey
ALTER TABLE "office_hours" ADD CONSTRAINT "office_hours_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "booking_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- Raw SQL objects Prisma cannot declare (E-001/S-00/T-02). Order: extension, CHECKs, indexes, exclusion, triggers, roles, grants.
-- ===========================================================================

-- btree_gist lets the exclusion constraint compare room_id with = inside a gist index (ADR-0006). Trusted extension, no superuser needed.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CHECK constraints
ALTER TABLE "office_hours" ADD CONSTRAINT "office_hours_opens_before_closes_chk" CHECK ("opens_at" < "closes_at");
ALTER TABLE "office_hours" ADD CONSTRAINT "office_hours_weekday_chk" CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_size_chk" CHECK ("size" >= 1);
ALTER TABLE "users" ADD CONSTRAINT "users_office_null_only_platform_admin_chk" CHECK ("office_id" IS NOT NULL OR "role" = 'platform_admin');
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_starts_before_ends_chk" CHECK ("starts_at" < "ends_at");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_attendees_chk" CHECK ("attendees" >= 1);
-- A visit has a check in time once it is checked in or out, and a check out time only once it is checked out.
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_in_at_chk" CHECK (("status" IN ('checked_in', 'checked_out')) = ("checked_in_at" IS NOT NULL));
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_out_at_chk" CHECK (("status" = 'checked_out') = ("checked_out_at" IS NOT NULL));
ALTER TABLE "visits" ADD CONSTRAINT "visits_check_out_after_in_chk" CHECK ("checked_out_at" IS NULL OR "checked_out_at" >= "checked_in_at");
-- Personal data may be cleared only by the purge, which sets anonymised_at (AC-09).
ALTER TABLE "visits" ADD CONSTRAINT "visits_name_until_anonymised_chk" CHECK ("name" IS NOT NULL OR "anonymised_at" IS NOT NULL);

-- Unique indexes on expressions and partial uniques
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" (lower("email"));
CREATE UNIQUE INDEX "rooms_office_lower_name_live_uq" ON "rooms" ("office_id", lower("name")) WHERE "deleted_at" IS NULL;

-- Partial indexes for the named visit queries
-- Q3 unseen arrivals of a host
CREATE INDEX "visits_host_unseen_idx" ON "visits" ("host_id") WHERE "host_seen_at" IS NULL AND "status" = 'checked_in';
-- Q4 purge: visits that still hold personal data
CREATE INDEX "visits_date_not_anonymised_idx" ON "visits" ("visit_date") WHERE "anonymised_at" IS NULL;
-- Q5 earlier days still checked in
CREATE INDEX "visits_office_checked_in_idx" ON "visits" ("office_id") WHERE "status" = 'checked_in';

-- Double booking guard, exactly as ADR-0006. '[)' lets back to back slots sit side by side. SQLSTATE 23P01 on a clash.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap_excl"
  EXCLUDE USING gist ("room_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&) WHERE ("status" = 'confirmed');

-- Audit log is append only (AC-51). The row trigger blocks UPDATE and DELETE. The statement trigger blocks TRUNCATE.
CREATE FUNCTION "audit_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append only: % is not allowed', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER "audit_events_no_change" BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_append_only"();
CREATE TRIGGER "audit_events_no_truncate" BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_events_append_only"();

-- Roles. Created without LOGIN and without a password. Ops and CI set both outside SQL. Safe to run on a database that has them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_web') THEN
    CREATE ROLE "app_web" NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
    CREATE ROLE "app_worker" NOLOGIN;
  END IF;
END
$$;

-- Grants. The migrator role (app_owner) owns the tables and is the only role that may TRUNCATE.
GRANT USAGE ON SCHEMA public TO "app_web", "app_worker";
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM "app_web", "app_worker";

-- app_web
GRANT SELECT, INSERT, UPDATE ON "offices", "office_hours", "rooms", "users", "sign_in_attempts", "sessions",
  "bookings", "booking_series", "visits", "idempotency_keys" TO "app_web";
GRANT INSERT, SELECT ON "audit_events" TO "app_web";
GRANT SELECT ON "job_runs" TO "app_web";
GRANT DELETE ON "sessions", "sign_in_attempts", "idempotency_keys" TO "app_web";

-- app_worker
GRANT SELECT ON "offices" TO "app_worker";
GRANT SELECT, UPDATE ON "visits" TO "app_worker";
GRANT INSERT, SELECT ON "audit_events" TO "app_worker";
GRANT INSERT, SELECT, UPDATE ON "job_runs" TO "app_worker";
GRANT SELECT, DELETE ON "sessions", "idempotency_keys", "sign_in_attempts" TO "app_worker";
