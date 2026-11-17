import Link from "next/link";

export const metadata = {
  title: "Terms — Walk Log",
};

export default function TermsPage() {
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
          <h1 className="heading">Terms</h1>
          <p className="sub">
            Walk Log is a personal, non-commercial project. It shows a summary of your own Strava
            walks and nothing else.
          </p>
          <p className="sub">
            The app is provided as-is, with no warranty and no uptime promise. Data may be missing
            or wrong if Strava is slow, rate limited, or returns something unexpected.
          </p>
          <p className="sub">
            You agree to use Walk Log in line with Strava&apos;s terms and API agreement. You are
            responsible for the activities you authorize us to read.
          </p>
          <p className="sub">
            Keep your PIN private. Anyone who knows it can see your dashboard, so do not share it.
          </p>
          <p className="sub">
            The owner may remove access or shut the project down at any time. You can disconnect or
            delete your data yourself from the settings page.
          </p>
          <p className="sub">
            See the <Link className="strava-link" href="/privacy">privacy page</Link> for what is
            stored and for how long.
          </p>
        </section>
      </div>
    </main>
  );
}
