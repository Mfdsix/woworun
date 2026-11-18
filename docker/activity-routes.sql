-- Adds per-activity GPX routes to an existing Walk Log database.
-- Run once on a server whose Postgres volume predates the activity_routes table:
--
--   docker compose exec -T db psql -U walklog -d walklog < docker/activity-routes.sql
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "activity_routes" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "points" JSONB NOT NULL,
    "point_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "activity_routes_activity_id_key"
    ON "activity_routes"("activity_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activity_routes_activity_id_fkey'
    ) THEN
        ALTER TABLE "activity_routes"
            ADD CONSTRAINT "activity_routes_activity_id_fkey"
            FOREIGN KEY ("activity_id") REFERENCES "manual_activities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
