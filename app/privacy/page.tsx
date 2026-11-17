import Link from "next/link";

export const metadata = {
  title: "Privacy — Walk Log",
};

// OWNER: replace the placeholder address below with your real contact email.
const CONTACT_EMAIL = "hello@example.com";

export default function PrivacyPage() {
  return (
    <main className="screen">
      <div className="settings">
        <div className="settings-head">
          <p className="brand">Walk Log</p>
          <Link className="btn btn-sm btn-ghost" href="/">
            Back to dashboard
          </Link>
        </div>

        <section className="panel">
          <h1 className="heading">Privacy</h1>

          <h2 className="settings-section-title">What we store</h2>
          <p className="sub">
            A hash of your PIN, your encrypted Strava refresh and access tokens, and activity
            summaries: activity id, name, start time, distance, and moving time.
          </p>

          <h2 className="settings-section-title">What we never store</h2>
          <p className="sub">GPS traces, polylines, raw streams, and photos.</p>

          <h2 className="settings-section-title">Retention</h2>
          <p className="sub">
            Activity summary cache lives for up to 1 hour and never longer than 7 days. Strava
            tokens are kept until you disconnect or delete your data.
          </p>

          <h2 className="settings-section-title">Third parties</h2>
          <p className="sub">
            We talk to the Strava API only. No ads, no analytics, no AI training, and no selling
            your data.
          </p>

          <h2 className="settings-section-title">Your controls</h2>
          <p className="sub">
            You can export your data, disconnect Strava, or delete everything from the settings
            page.
          </p>

          <h2 className="settings-section-title">Contact</h2>
          <p className="sub">
            Questions: <a className="strava-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>

          <h2 className="settings-section-title">Strava</h2>
          <p className="sub">
            Powered by Strava. Walk Log is not affiliated with or endorsed by Strava.
          </p>
        </section>
      </div>
    </main>
  );
}
