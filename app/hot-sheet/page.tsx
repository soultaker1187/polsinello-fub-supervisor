import { Shell } from "@/lib/Shell";
import { fubPersonUrl } from "@/lib/config";
import { fmtDate, fmtDateTime, num } from "@/lib/fmt";
import { getReport } from "@/lib/scan";
import type { Row } from "@/lib/audit";

export const dynamic = "force-dynamic";
const DAY = 86400000;

function Leads({ rows, limitDays, label }: { rows: Row[]; limitDays: number; label: string }) {
  return (
    <div className="card">
      <table>
        <thead><tr><th>Lead</th><th>Stage</th><th>Source</th><th>Last connected</th><th className="r">Days</th><th>{label}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><a href={fubPersonUrl(r.id)} target="_blank" rel="noreferrer noopener">{r.name}</a></td>
              <td>{r.stage || "—"}</td><td>{r.source || "—"}</td><td>{fmtDate(r.lastContact)}</td><td className="r">{num(r.days)}</td>
              <td>{fmtDate((r.lastContact ?? r.created) + limitDays * DAY)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="muted">Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function HotSheet({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const report = await getReport();
  const agents = (report?.agents ?? []).filter((a) => a.inScope || a.newLeads);
  const picked = Number((await searchParams).agent) || agents[0]?.userId || 0;
  const agent = agents.find((a) => a.userId === picked);
  const s = report?.settings;
  const waiting = (report?.newLeads ?? []).filter((l) => l.userId === picked && l.status === "none");
  const atRisk = (report?.atRisk ?? []).filter((r) => r.userId === picked);
  const neglected = (report?.neglected ?? []).filter((r) => r.userId === picked);

  return (
    <Shell>
      <h1>Hot sheets</h1>
      <p className="sub">{report ? `Each agent's call list for today, from the audit of ${fmtDateTime(report.generatedAt)}` : "No audit has run yet."}</p>
      {report && s && (
        <>
          <div className="filters">{agents.map((a) => <a key={a.userId} className={a.userId === picked ? "on" : ""} href={`/hot-sheet?agent=${a.userId}`}>{a.name} ({a.atRisk + a.neglected})</a>)}</div>
          {agent && (
            <>
              <div className="tiles">
                <div className="tile hot"><div className="n">{waiting.length}</div><div className="l">New leads with no response</div></div>
                <div className="tile hot"><div className="n">{num(agent.atRisk)}</div><div className="l">At risk: call before they become neglected</div></div>
                <div className="tile"><div className="n">{num(agent.neglected)}</div><div className="l">Neglected ({agent.pctNeglected}% of active leads)</div></div>
                <div className="tile"><div className="n">{agent.belowStandard.length ? "Below" : "Meets"}</div><div className="l">Accountability standard{agent.belowStandard.length ? `: ${agent.belowStandard.join("; ")}` : ""}</div></div>
              </div>

              <h2>1. New leads waiting for a first response</h2>
              <div className="card">
                <table>
                  <thead><tr><th>Lead</th><th>Source</th><th>Arrived</th></tr></thead>
                  <tbody>
                    {waiting.map((l) => <tr key={l.id}><td><a href={fubPersonUrl(l.id)} target="_blank" rel="noreferrer noopener">{l.name}</a></td><td>{l.source || "—"}</td><td>{fmtDateTime(l.created)}</td></tr>)}
                    {!waiting.length && <tr><td colSpan={3} className="muted">None.</td></tr>}
                  </tbody>
                </table>
              </div>

              <h2>2. At risk ({s.atRiskDays}–{s.neglectedDays - 1} days without contact)</h2>
              <Leads rows={atRisk.slice(0, 100)} limitDays={s.neglectedDays} label="Becomes neglected" />
              {atRisk.length > 100 && <p className="muted">Showing 100 of {num(atRisk.length)}.</p>}

              <h2>3. Neglected ({s.neglectedDays}+ days), most recent slips first</h2>
              <Leads rows={neglected.slice(0, 50)} limitDays={s.neglectedDays} label="Neglected since" />
              {neglected.length > 50 && <p className="muted">Showing 50 of {num(neglected.length)}. The full list is under <a href={`/needs-a-call?agent=${picked}`}>Needs A Call</a>.</p>}
            </>
          )}
        </>
      )}
    </Shell>
  );
}
