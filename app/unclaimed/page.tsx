import { Shell } from "@/lib/Shell";
import { RunButton } from "@/lib/RunButton";
import { fubPersonUrl } from "@/lib/config";
import { fmtDate, fmtDateTime, num } from "@/lib/fmt";
import { getActivity, REGULAR_MIN_DAYS } from "@/lib/activity";

export const dynamic = "force-dynamic";
const shortDay = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${d}T12:00:00Z`));

export default async function Unclaimed() {
  const report = await getActivity();
  const rows = report?.regulars ?? [];
  const groups = new Map<string, number>();
  for (const r of rows) groups.set(r.heldBy, (groups.get(r.heldBy) ?? 0) + 1);
  return (
    <Shell>
      <h1>Unclaimed &amp; active</h1>
      <p className="sub">
        {report
          ? `Leads with no specific agent that were active on ${REGULAR_MIN_DAYS} or more of the past 7 days. "No specific agent" means the lead is in a pond, has no one assigned, or sits in a holding account. Updated ${fmtDateTime(report.generatedAt)}.`
          : "Not loaded yet. Press Refresh activity to read the past seven days."}
      </p>
      <p><RunButton endpoint="/api/activity" label="Refresh activity" noun="events" /></p>
      {report && (
        <>
          <div className="tiles">
            <div className="tile hot"><div className="n">{num(rows.length)}</div><div className="l">Unclaimed leads active {REGULAR_MIN_DAYS}+ days this week</div></div>
            {[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, n]) => <div className="tile" key={g}><div className="n">{num(n)}</div><div className="l">{g}</div></div>)}
          </div>
          <h2>Most regular first</h2>
          <div className="card">
            <table>
              <thead><tr><th>Lead</th><th>Held by</th><th>Stage</th><th>Source</th><th className="r">Days active</th><th className="r">Events</th><th>What they did</th><th>Last active</th><th>Last contact</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><a href={fubPersonUrl(l.id)} target="_blank" rel="noreferrer noopener">{l.name}</a></td>
                    <td>{l.heldBy}</td><td>{l.stage || "—"}</td><td>{l.source || "—"}</td>
                    <td className="r">{l.activeDays} of 7</td><td className="r">{num(l.events)}</td>
                    <td>{l.types.map(([t, n]) => `${t} ×${n}`).join(", ")}</td>
                    <td>{shortDay(l.lastActive)}</td><td>{fmtDate(l.lastContact)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={9} className="muted">No unclaimed lead was active on {REGULAR_MIN_DAYS} or more days this week.</td></tr>}
              </tbody>
            </table>
          </div>
          {report.regularsTruncated && <p className="muted">Only the {num(report.regularsChecked)} most regular leads were checked for assignment, so a few with fewer active days may be missing.</p>}
        </>
      )}
    </Shell>
  );
}
