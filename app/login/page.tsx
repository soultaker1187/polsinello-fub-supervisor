export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="login">
      <h1>Database Supervisor</h1>
      <p className="sub">The Polsinello Team</p>
      {e === "1" && <p className="pill bad">That password did not match.</p>}
      {e === "setup" && <p className="banner warn">Sign-in is not set up yet. Add DASHBOARD_PASSWORD in the Vercel project settings, then redeploy.</p>}
      <form method="post" action="/api/login">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <button className="btn" type="submit">Sign in</button>
      </form>
    </div>
  );
}
