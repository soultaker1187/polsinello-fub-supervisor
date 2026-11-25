import { Shell } from "@/lib/Shell";
import { RunButton } from "@/lib/RunButton";
import { fubConfigured } from "@/lib/fub";
import { fmtDateTime, fmtMinutes, num } from "@/lib/fmt";
import { getHistory, getReport, getSettings, getState } from "@/lib/scan";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const [report, settings, state, history] = await Promise.all([getReport(), getSettings(), getState(), getHistory()]);
  const configured = fubConfigured();
  const graded = report?.newLeads.filter((l) => l.status !== "pending") ?? [];
  const inTime = graded.filter((l) => l.status === "in_time").length;
  const prev = history.length > 1 ? history[history.length - 2] : null;

  return (
    <Shell>
      <h1>Overview</h1>
      <p className="sub">{report ? `Last audit ${fmtDateTime(report.generatedAt)} · ${num(report.totals.people)} contacts read in ${report.diagnostics.seconds} seconds` : "No audit has run yet."}</p>

      {!configured && (
        <div className="banner warn">
          <strong>One step left: connect Follow Up Boss.</strong>
          <ol className="setup">
            <li>In Follow Up Boss, open Admin → API and copy your API key.</li>
            <li>In Vercel, open this project → Settings → Environment Variables and add <code>FUB_API_KEY</code> with that key (Production).</li>
            <li>Redeploy, then press Run audit now.</li>
          </ol>
        </div>
      )}
      <div className={`banner ${settings.mode}`}>
        {settings.mode === "preview"
          ? <><strong>Preview mode.</strong> Nothing is being written to Follow Up Boss. The notes below are what would be sent. Switch to live in Settings when the lists look right.</>
          : <><strong>Live.</strong> “Needs A Call” notes are being added to leads in Follow Up Boss{settings.alsoCreateTask ? ", with a Call task for the agent" : ""}.</>}
      </div>
      {state?.phase === "error" && <div className="banner warn"><strong>The last run stopped:</strong> {state.error}</div>}

      <p><RunButton /></p>

      {report && (
        <>
          <div className="tiles">
            <a className="tile hot" href="/needs-a-call"><div className="n">{num(report.totals.neglected)}</div><div className="l">Need a call (no contact in {report.settings.neglectedDays}+ days){prev ? ` · was ${num(prev.neglected)}` : ""}</div></a>
            <a className="tile hot" href="/new-leads"><div className="n">{graded.length ? Math.round((inTime / graded.length) * 100) : 0}%</div><div className="l">New leads reached within {report.settings.responseMinutes} min ({inTime} of {graded.length}, last 7 days)</div></a>
            <div className="tile"><div className="n">{num(report.totals.inScope)}</div><div className="l">Active leads being watched</div></div>
            <div className="tile"><div className="n">{num(report.totals.neverContacted)}</div><div className="l">Of those, never contacted</div></div>
            <a className="tile" href="/hygiene?tab=duplicates"><div className="n">{num(report.totals.duplicateGroups)}</div><div className="l">Possible duplicates</div></a>
            <a className="tile" href="/hygiene?tab=unassigned"><div className="n">{num(report.totals.unassigned)}</div><div className="l">Not assigned to anyone</div></a>
            <a className="tile" href="/hygiene?tab=unreachable"><div className="n">{num(report.totals.noContactInfo)}</div><div className="l">No phone and no email</div></a>
            <div className="tile"><div className="n">{num(report.notes.mode === "live" ? report.notes.written : report.notes.planned)}</div><div className="l">Notes {report.notes.mode === "live" ? "written" : "that would be written"} this run{report.notes.heldBackByCaps ? ` · ${num(report.notes.heldBackByCaps)} held for later runs` : ""}</div></div>
          </div>

          <h2>Agent scorecard</h2>
          <div className="card">
            <table>
              <thead><tr><th>Agent</th><th className="r">Active leads</th><th className="r">Need a call</th><th className="r">% neglected</th><th className="r">New leads (7 days)</th><th className="r">Within {report.settings.responseMinutes} min</th><th className="r">Late</th><th className="r">No response</th><th className="r">Typical response</th></tr></thead>
              <tbody>
                {report.agents.filter((a) => a.inScope || a.newLeads).map((a) => (
                  <tr key={a.userId}>
                    <td><a href={`/needs-a-call?agent=${a.userId}`}>{a.name}</a></td>
                    <td className="r">{num(a.inScope)}</td>
                    <td className="r">{num(a.neglected)}</td>
                    <td className="r"><span className={`pill ${a.pctNeglected >= 50 ? "bad" : a.pctNeglected <= 15 ? "good" : ""}`}>{a.pctNeglected}%</span></td>
                    <td className="r">{a.newLeads}</td>
                    <td className="r">{a.inTime}</td>
                    <td className="r">{a.late}</td>
                    <td className="r">{a.none}</td>
                    <td className="r">{a.newLeads ? fmtMinutes(a.medianMinutes) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Needs A Call notes, this run</h2>
          <div className="card">
            <table>
              <thead><tr><th>Lead</th><th>Agent</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {report.notes.items.slice(0, 25).map((n) => (
                  <tr key={n.personId}><td>{n.name}</td><td>{n.agent}</td><td>{n.reason}</td><td><span className={`pill ${n.status === "written" ? "good" : n.status === "failed" ? "bad" : "gold"}`}>{n.status === "planned" ? "Preview only" : n.status === "written" ? "Written" : "Failed"}</span></td></tr>
                ))}
                {!report.notes.items.length && <tr><td colSpan={4} className="muted">No notes this run.</td></tr>}
              </tbody>
            </table>
          </div>
          {report.notes.items.length > 25 && <p className="muted">Showing 25 of {num(report.notes.items.length)}.</p>}

          {report.diagnostics.usedLastActivityFallback && (
            <div className="banner warn" style={{ marginTop: 18 }}>Follow Up Boss did not return call, text or email dates for this account, so “last contact” is using last activity instead, which also counts website visits. Tell Claude so the check can be adjusted.</div>
          )}
        </>
      )}
    </Shell>
  );
}
