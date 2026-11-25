import { Shell } from "@/lib/Shell";
import { fubPersonUrl } from "@/lib/config";
import { fmtDate, num } from "@/lib/fmt";
import { getReport } from "@/lib/scan";
import type { Row } from "@/lib/audit";

export const dynamic = "force-dynamic";
const TABS = [["duplicates", "Possible duplicates"], ["unassigned", "Not assigned"], ["unreachable", "No phone or email"], ["nosource", "No source"], ["stages", "Stages"]] as const;

function Rows({ rows }: { rows: Row[] }) {
  return (
    <div className="card">
      <table>
        <thead><tr><th>Lead</th><th>Agent</th><th>Stage</th><th>Source</th><th>Arrived</th></tr></thead>
        <tbody>
          {rows.slice(0, 500).map((r) => (
            <tr key={r.id}><td><a href={fubPersonUrl(r.id)} target="_blank" rel="noreferrer noopener">{r.name}</a></td><td>{r.agent || "—"}</td><td>{r.stage || "—"}</td><td>{r.source || "—"}</td><td>{fmtDate(r.created)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function Hygiene({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "duplicates";
  const report = await getReport();
  return (
    <Shell>
      <h1>Clean-up</h1>
      <p className="sub">Records that make the database harder to work. Nothing on this page is changed automatically. Each table shows up to 500 records.</p>
      <div className="filters">{TABS.map(([k, label]) => <a key={k} className={tab === k ? "on" : ""} href={`/hygiene?tab=${k}`}>{label}</a>)}</div>
      {!report && <p className="muted">No audit has run yet.</p>}
      {report && tab === "duplicates" && (
        <div className="card">
          <table>
            <thead><tr><th>Matched on</th><th>Records sharing it</th></tr></thead>
            <tbody>
              {report.hygiene.duplicates.slice(0, 500).map((d, i) => (
                <tr key={i}><td>Same {d.type}</td><td>{d.people.map((p, j) => <span key={p.id}>{j > 0 && " · "}<a href={fubPersonUrl(p.id)} target="_blank" rel="noreferrer noopener">{p.name}</a>{p.agent ? ` (${p.agent})` : ""}</span>)}</td></tr>
              ))}
              {!report.hygiene.duplicates.length && <tr><td colSpan={2} className="muted">No duplicates found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {report && tab === "unassigned" && <Rows rows={report.hygiene.unassigned} />}
      {report && tab === "unreachable" && <Rows rows={report.hygiene.noContactInfo} />}
      {report && tab === "nosource" && <Rows rows={report.hygiene.noSource} />}
      {report && tab === "stages" && (
        <div className="card">
          <table>
            <thead><tr><th>Stage</th><th className="r">Contacts</th><th>Watched for neglect</th></tr></thead>
            <tbody>{report.stages.map((s) => <tr key={s.name}><td>{s.name}</td><td className="r">{num(s.count)}</td><td>{s.inScope ? <span className="pill good">Yes</span> : <span className="pill">Left out</span>}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
