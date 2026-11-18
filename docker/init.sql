-- Walk Log schema. Generated from prisma/schema.prisma (prisma migrate diff).
-- Applied automatically by the postgres container on first boot.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "pin_lookup" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strava_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "athlete_id" BIGINT NOT NULL,
    "athlete_name" TEXT,
    "avatar_url" TEXT,
    "scope" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_enc" TEXT,
    "access_expires_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strava_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "user_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "rate_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "manual_activities" (
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

-- CreateIndex
CREATE UNIQUE INDEX "users_pin_lookup_key" ON "users"("pin_lookup");

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_user_id_key" ON "strava_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_athlete_id_key" ON "strava_connections"("athlete_id");

-- CreateIndex
CREATE INDEX "dashboard_snapshots_expires_at_idx" ON "dashboard_snapshots"("expires_at");

-- CreateIndex
CREATE INDEX "manual_activities_user_id_start_local_idx" ON "manual_activities"("user_id", "start_local");

-- CreateIndex
CREATE UNIQUE INDEX "manual_activities_user_id_activity_key_key" ON "manual_activities"("user_id", "activity_key");

-- AddForeignKey
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_activities" ADD CONSTRAINT "manual_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE IF NOT EXISTS "activity_routes" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "points" JSONB NOT NULL,
    "point_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "activity_routes_activity_id_key" ON "activity_routes"("activity_id");

-- AddForeignKey
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
