import { Shell } from "@/lib/Shell";
import { fubPersonUrl } from "@/lib/config";
import { fmtDateTime, fmtMinutes } from "@/lib/fmt";
import { getAlerts, getReport } from "@/lib/scan";

export const dynamic = "force-dynamic";
const STATUS = { in_time: ["good", "In time"], late: ["bad", "Late"], none: ["bad", "No response"], pending: ["gold", "Still on the clock"] } as const;

export default async function NewLeads() {
  const [report, alerts] = await Promise.all([getReport(), getAlerts()]);
  const recent = alerts.items.filter((a) => a.at > Date.now() - 86400000);
  return (
    <Shell>
      <h1>New leads</h1>
      <p className="sub">{report ? `Every lead that arrived in the last 7 days, and how long its agent took to make a first ${report.settings.responseCounts === "call" ? "call" : "call or personal text"}. Standard: ${report.settings.responseMinutes} minutes. Leads arriving outside ${report.settings.clockStartHour}:00–${report.settings.clockEndHour}:00 are timed from ${report.settings.clockStartHour}:00.` : "No audit has run yet."}</p>

      <h2>Flagged in the last 24 hours</h2>
      <div className="card">
        <table>
          <thead><tr><th>Lead</th><th>Agent</th><th>Flagged</th><th>Reason</th><th>Note</th></tr></thead>
          <tbody>
            {recent.map((a) => (
              <tr key={a.personId}><td><a href={fubPersonUrl(a.personId)} target="_blank" rel="noreferrer noopener">{a.name}</a></td><td>{a.agent}</td><td>{fmtDateTime(a.at)}</td><td>{a.reason}</td>
                <td><span className={`pill ${a.status === "written" ? "good" : a.status === "failed" ? "bad" : "gold"}`}>{a.status === "planned" ? "Preview only" : a.status === "written" ? "Written" : "Failed"}</span></td></tr>
            ))}
            {!recent.length && <tr><td colSpan={5} className="muted">No new lead has missed the standard in the last 24 hours.</td></tr>}
          </tbody>
        </table>
      </div>

      {report && (
        <>
          <h2>Last 7 days</h2>
          <div className="card">
            <table>
              <thead><tr><th>Lead</th><th>Agent</th><th>Source</th><th>Arrived</th><th>First response</th><th className="r">Waited</th><th>Result</th></tr></thead>
              <tbody>
                {report.newLeads.map((l) => (
                  <tr key={l.id}>
                    <td><a href={fubPersonUrl(l.id)} target="_blank" rel="noreferrer noopener">{l.name}</a></td>
                    <td>{l.agent}</td><td>{l.source || "—"}</td><td>{fmtDateTime(l.created)}</td>
                    <td>{l.firstResponse ? fmtDateTime(l.firstResponse) : "—"}</td>
                    <td className="r">{l.status === "pending" ? "—" : fmtMinutes(l.minutes)}</td>
                    <td><span className={`pill ${STATUS[l.status][0]}`}>{STATUS[l.status][1]}</span></td>
                  </tr>
                ))}
                {!report.newLeads.length && <tr><td colSpan={7} className="muted">No new leads in the last 7 days.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}
