type SyncBannerProps = {
  status?: string;
  stale: boolean;
};

type BannerContent = { text: string; tone: "ok" | "warn" | "error" };

const STATUS_CONTENT: Record<string, BannerContent> = {
  ok: { text: "Synced just now.", tone: "ok" },
  wait: { text: "Refresh is cooling down. Try again in a minute.", tone: "warn" },
  rate_limited: {
    text: "Strava rate limit reached. Showing the latest cached data.",
    tone: "warn",
  },
  reauth: { text: "Strava access expired. Reconnect to continue.", tone: "error" },
  failed: { text: "Sync failed. Try again.", tone: "error" },
  stale: { text: "Showing cached data.", tone: "warn" },
};

const TONE_CLASS: Record<BannerContent["tone"], string> = {
  ok: "banner-ok",
  warn: "banner-warn",
  error: "banner-error",
};

export function SyncBanner({ status, stale }: SyncBannerProps) {
  const content = status
    ? STATUS_CONTENT[status]
    : stale
      ? STATUS_CONTENT.stale
      : undefined;

  if (!content) return null;

  return <p className={`banner ${TONE_CLASS[content.tone]}`}>{content.text}</p>;
}
