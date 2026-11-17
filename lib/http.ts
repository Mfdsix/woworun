import { getEnv } from "@/lib/env";

/**
 * Build an absolute redirect URL from APP_URL.
 *
 * Never derive redirects from `request.url`: behind a reverse proxy the host
 * can be the container's bind address (0.0.0.0:3000), which would send the
 * browser to an unreachable origin.
 */
export function publicUrl(path: string): URL {
  return new URL(path, getEnv().APP_URL);
}
