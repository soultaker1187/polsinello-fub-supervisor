import { Shell } from "@/lib/Shell";
import { RunButton } from "@/lib/RunButton";
import { fubPersonUrl, TZ } from "@/lib/config";
import { fmtDate, fmtDateTime, num } from "@/lib/fmt";
import { getActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const dayLabel = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(new Date(`${d}T12:00:00Z`));

export default async function Active() {
  const report = await getActivity();
  return (
    <Shell>
      <h1>Most active leads</h1>
      <p className="sub">
        {report
          ? `Each day's 25 most active leads over the past seven days, ranked by website visits, property views, saved homes and inquiries recorded in Follow Up Boss. Updated ${fmtDateTime(report.generatedAt)} from ${num(report.eventsRead)} events. Days are in ${TZ.replace("_", " ")} time.`
          : "Not loaded yet. Press Refresh activity to read the past seven days."}
      </p>
      <p><RunButton endpoint="/api/activity" label="Refresh activity" noun="events" /></p>
      {report?.days.map((d) => (
        <section key={d.date}>
          <h2>{dayLabel(d.date)} <span className="muted" style={{ fontWeight: 400 }}>· {num(d.activeLeads)} active leads, {num(d.events)} events</span></h2>
          <div className="card">
            <table>
              <thead><tr><th className="r">#</th><th>Lead</th><th>Agent</th><th>Stage</th><th className="r">Events</th><th>What they did</th><th>Last contact by agent</th></tr></thead>
              <tbody>
                {d.leads.map((l, i) => (
                  <tr key={l.id}>
                    <td className="r">{i + 1}</td>
                    <td><a href={fubPersonUrl(l.id)} target="_blank" rel="noreferrer noopener">{l.name}</a></td>
                    <td>{l.agent || "—"}</td><td>{l.stage || "—"}</td><td className="r">{num(l.events)}</td>
                    <td>{l.types.map(([t, n]) => `${t} ×${n}`).join(", ")}</td>
                    <td>{fmtDate(l.lastContact)}</td>
                  </tr>
                ))}
                {!d.leads.length && <tr><td colSpan={7} className="muted">No activity recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </Shell>
  );
}
