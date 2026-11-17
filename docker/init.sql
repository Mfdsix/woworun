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

-- CreateIndex
CREATE UNIQUE INDEX "users_pin_lookup_key" ON "users"("pin_lookup");

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_user_id_key" ON "strava_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_athlete_id_key" ON "strava_connections"("athlete_id");

-- CreateIndex
CREATE INDEX "dashboard_snapshots_expires_at_idx" ON "dashboard_snapshots"("expires_at");

-- AddForeignKey
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

