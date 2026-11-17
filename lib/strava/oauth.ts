import { z } from "zod";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const DEACTIVATE_URL = "https://www.strava.com/oauth/deactivate";

export const STRAVA_SCOPE = "read,activity:read_all";

const tokenSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    expires_at: z.number(),
    scope: z.string().optional(),
    athlete: z
      .object({
        id: z.number(),
        firstname: z.string().optional(),
        lastname: z.string().optional(),
        profile: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type StravaTokenResponse = z.infer<typeof tokenSchema>;

async function postForm(url: string, fields: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    cache: "no-store",
  });
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", STRAVA_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<StravaTokenResponse> {
  const response = await postForm(TOKEN_URL, {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
  });

  if (!response.ok) {
    throw new Error("strava_token_exchange_failed");
  }

  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new Error("strava_token_exchange_failed");
  }

  return parsed.data;
}

export async function refreshAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<StravaTokenResponse> {
  const response = await postForm(TOKEN_URL, {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });

  if (response.status === 400) {
    throw new Error("strava_invalid_grant");
  }

  if (!response.ok) {
    throw new Error("strava_refresh_failed");
  }

  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new Error("strava_refresh_failed");
  }

  return parsed.data;
}

export async function deauthorize(accessToken: string): Promise<void> {
  try {
    await postForm(DEACTIVATE_URL, { access_token: accessToken });
  } catch {
    return;
  }
}
