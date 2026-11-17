-- Adds DB-backed manual activities to an existing Walk Log database.
-- Run once on a server whose Postgres volume predates the manual_activities table:
--
--   docker compose exec -T db psql -U walklog -d walklog < docker/manual-activities.sql
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "manual_activities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_local" TEXT NOT NULL,
    "distance_m" DOUBLE PRECISION NOT NULL,
    "moving_time_s" INTEGER NOT NULL,
    "elapsed_time_s" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manual_activities_user_id_activity_key_key"
    ON "manual_activities"("user_id", "activity_key");

CREATE INDEX IF NOT EXISTS "manual_activities_user_id_start_local_idx"
    ON "manual_activities"("user_id", "start_local");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manual_activities_user_id_fkey'
    ) THEN
        ALTER TABLE "manual_activities"
            ADD CONSTRAINT "manual_activities_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
