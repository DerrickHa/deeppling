import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Enterprise Payroll on Unlink x Monad</h1>
        <p>
          US-first employee onboarding with invite links, simulated compliance states, managed wallets, and AI-assisted
          payroll execution.
        </p>
        <div className="row wrap">
          <Link href="/admin">
            <button type="button">Start Admin Wizard</button>
          </Link>
          <Link href="/payroll">
            <button type="button" className="secondary">
              Open Payroll Ops
            </button>
          </Link>
        </div>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <h2>Onboarding Model</h2>
          <ul className="list">
            <li>Admin wizard: workspace, KYB, treasury, payroll policy.</li>
            <li>Checklist hub tracks readiness blockers and completion state.</li>
            <li>Employees onboard via secure invite token links.</li>
            <li>Strict readiness gates before payroll inclusion.</li>
          </ul>
        </article>

        <article className="card">
          <h2>Execution Controls</h2>
          <ul className="list">
            <li>AI proposes risk flags and payout ordering.</li>
            <li>Finance approval required before payout execution.</li>
            <li>Idempotency keys prevent duplicate payouts.</li>
            <li>Circuit breaker halts runs on elevated failure rates.</li>
          </ul>
        </article>
      </section>
    </>
  );
}
