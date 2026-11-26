import { Shell } from "@/lib/Shell";
import { fubPersonUrl } from "@/lib/config";
import { num } from "@/lib/fmt";
import { getReport } from "@/lib/scan";

export const dynamic = "force-dynamic";

export default async function Sweeps() {
  const report = await getReport();
  const sw = report?.sweeps;
  return (
    <Shell>
      <h1>Sweeps</h1>
      <p className="sub">Leads neglected for {report?.settings.sweepAfterDays ?? 30} days or more are moved out of the agent's name and into a pond, so someone who wants them can pick them up.</p>
      {!report && <p className="muted">No audit has run yet.</p>}
      {sw && sw.mode === "off" && <div className="banner preview"><strong>Sweeps are off.</strong> Choose the receiving pond in Settings to see a preview. Your ponds are listed there after the first audit.</div>}
      {sw && sw.mode === "preview" && <div className="banner preview"><strong>Preview.</strong> Nothing has been moved. These {num(sw.planned)} leads would go to “{sw.pondName}”{sw.heldBackByCap ? `, with ${num(sw.heldBackByCap)} more held for later runs` : ""}.</div>}
      {sw && sw.mode === "live" && <div className="banner live"><strong>Live.</strong> {num(sw.moved)} leads moved to “{sw.pondName}” this run{sw.failed ? `, ${sw.failed} failed` : ""}{sw.heldBackByCap ? `, ${num(sw.heldBackByCap)} held for later runs` : ""}.</div>}
      {sw && sw.mode !== "off" && (
        <div className="card">
          <table>
            <thead><tr><th>Lead</th><th>Assigned to</th><th className="r">Days without contact</th><th>Status</th></tr></thead>
            <tbody>
              {sw.items.map((i) => (
                <tr key={i.personId}><td><a href={fubPersonUrl(i.personId)} target="_blank" rel="noreferrer noopener">{i.name}</a></td><td>{i.fromAgent}</td><td className="r">{num(i.days)}</td>
                  <td><span className={`pill ${i.status === "moved" ? "good" : i.status === "failed" ? "bad" : "gold"}`}>{i.status === "planned" ? "Preview only" : i.status === "moved" ? "Moved" : "Failed"}</span></td></tr>
              ))}
              {!sw.items.length && <tr><td colSpan={4} className="muted">No leads meet the sweep rule.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
