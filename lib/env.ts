import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  STRAVA_CLIENT_ID: z.string().optional().default(""),
  STRAVA_CLIENT_SECRET: z.string().optional().default(""),
  MAX_USERS: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = Array.from(
      new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "environment")),
    );
    throw new Error(`Invalid environment: ${fields.join(", ")}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
