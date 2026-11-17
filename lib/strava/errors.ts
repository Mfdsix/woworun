export class StravaRateLimitedError extends Error {
  constructor(message = "strava_rate_limited") {
    super(message);
    this.name = "StravaRateLimitedError";
  }
}

export class NeedsReauthError extends Error {
  constructor(message = "strava_needs_reauth") {
    super(message);
    this.name = "NeedsReauthError";
  }
}

export class StravaSyncError extends Error {
  constructor(message = "strava_sync_failed") {
    super(message);
    this.name = "StravaSyncError";
  }
}
