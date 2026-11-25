import { Shell } from "@/lib/Shell";
import { fubPersonUrl } from "@/lib/config";
import { fmtDate, num } from "@/lib/fmt";
import { getReport } from "@/lib/scan";

export const dynamic = "force-dynamic";
const PER = 100;

export default async function NeedsACall({ searchParams }: { searchParams: Promise<{ agent?: string; page?: string }> }) {
  const sp = await searchParams;
  const report = await getReport();
  const agentId = sp.agent ? Number(sp.agent) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = (report?.neglected ?? []).filter((r) => !agentId || r.userId === agentId);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const slice = rows.slice((page - 1) * PER, page * PER);
  const q = (p: number) => `/needs-a-call?${agentId ? `agent=${agentId}&` : ""}page=${p}`;

  return (
    <Shell>
      <h1>Needs A Call</h1>
      <p className="sub">{report ? `${num(rows.length)} active leads with no call, text or email in ${report.settings.neglectedDays} days or more. Most recent slips first.` : "No audit has run yet."}</p>
      {report && (
        <>
          <div className="filters">
            <a className={!agentId ? "on" : ""} href="/needs-a-call">Everyone</a>
            {report.agents.filter((a) => a.neglected).map((a) => (
              <a key={a.userId} className={agentId === a.userId ? "on" : ""} href={`/needs-a-call?agent=${a.userId}`}>{a.name} ({num(a.neglected)})</a>
            ))}
          </div>
          <div className="card">
            <table>
              <thead><tr><th>Lead</th><th>Agent</th><th>Stage</th><th>Source</th><th>Last contact</th><th className="r">Days</th><th>Arrived</th></tr></thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id}>
                    <td><a href={fubPersonUrl(r.id)} target="_blank" rel="noreferrer noopener">{r.name}</a></td>
                    <td>{r.agent}</td><td>{r.stage || "—"}</td><td>{r.source || "—"}</td>
                    <td>{fmtDate(r.lastContact)}</td><td className="r">{num(r.days)}</td><td>{fmtDate(r.created)}</td>
                  </tr>
                ))}
                {!slice.length && <tr><td colSpan={7} className="muted">Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pager">
            {page > 1 && <a className="btn alt" href={q(page - 1)}>Previous</a>}
            <span>Page {page} of {pages}</span>
            {page < pages && <a className="btn alt" href={q(page + 1)}>Next</a>}
          </div>
          {report.neglectedTruncated && <p className="muted">The list is capped at 20,000 leads; the totals above count all of them.</p>}
        </>
      )}
    </Shell>
  );
}
