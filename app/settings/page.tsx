import { Shell } from "@/lib/Shell";
import { getReport, getSettings } from "@/lib/scan";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; needconfirm?: string }> }) {
  const sp = await searchParams;
  const [s, report] = await Promise.all([getSettings(), getReport()]);
  return (
    <Shell>
      <h1>Settings</h1>
      <p className="sub">Changes apply from the next run.</p>
      {sp.saved && <div className="banner live">Saved.</div>}
      {sp.needconfirm && <div className="banner warn">Saved, but still in preview. To go live, tick the confirmation box as well.</div>}
      <form className="settings" method="post" action="/api/settings">
        <fieldset>
          <legend>Standards</legend>
          <div className="row2">
            <div><label htmlFor="neglectedDays">Neglected after (days)</label><input id="neglectedDays" name="neglectedDays" type="number" min={1} max={365} defaultValue={s.neglectedDays} /></div>
            <div><label htmlFor="responseMinutes">New lead response (minutes)</label><input id="responseMinutes" name="responseMinutes" type="number" min={1} max={1440} defaultValue={s.responseMinutes} /></div>
          </div>
          <div><label htmlFor="atRiskDays">At risk after (days) <span className="hint">(the early warning before a lead becomes neglected)</span></label><input id="atRiskDays" name="atRiskDays" type="number" min={1} max={364} defaultValue={s.atRiskDays} /></div>
          <div><label htmlFor="responseCounts">What counts as a first response</label>
            <select id="responseCounts" name="responseCounts" defaultValue={s.responseCounts}><option value="call_or_text">A call or a personal text</option><option value="call">A call only</option></select>
            <span className="hint">Automated action-plan texts and emails never count.</span></div>
          <div className="row2">
            <div><label htmlFor="clockStartHour">Response clock starts (hour, Toronto)</label><input id="clockStartHour" name="clockStartHour" type="number" min={0} max={23} defaultValue={s.clockStartHour} /></div>
            <div><label htmlFor="clockEndHour">Response clock ends (hour)</label><input id="clockEndHour" name="clockEndHour" type="number" min={1} max={24} defaultValue={s.clockEndHour} /></div>
          </div>
          <div><label htmlFor="excludedStages">Stages left out of the neglected check <span className="hint">(one per line)</span></label>
            <textarea id="excludedStages" name="excludedStages" rows={5} defaultValue={s.excludedStages.join("\n")} />
            {report && <span className="hint">Stages in your account: {report.stages.map((x) => `${x.name} (${x.count})`).join(", ")}</span>}</div>
        </fieldset>
        <fieldset>
          <legend>Needs A Call notes</legend>
          <div><label htmlFor="mode">Mode</label>
            <select id="mode" name="mode" defaultValue={s.mode}><option value="preview">Preview: write nothing to Follow Up Boss</option><option value="live">Live: add notes to leads in Follow Up Boss</option></select></div>
          {s.mode !== "live" && <label style={{ fontWeight: 400 }}><input type="checkbox" name="confirmLive" value="yes" /> I have reviewed the preview lists and want notes written to Follow Up Boss.</label>}
          <label style={{ fontWeight: 400 }}><input type="checkbox" name="alsoCreateTask" defaultChecked={s.alsoCreateTask} /> Also create a Call task named “Needs A Call” for the agent, due the same day</label>
          <div className="row2">
            <div><label htmlFor="maxNotesPerAgent">Most notes per agent, per run</label><input id="maxNotesPerAgent" name="maxNotesPerAgent" type="number" min={1} max={200} defaultValue={s.maxNotesPerAgent} /></div>
            <div><label htmlFor="maxNotesPerRun">Most notes in total, per run</label><input id="maxNotesPerRun" name="maxNotesPerRun" type="number" min={1} max={1000} defaultValue={s.maxNotesPerRun} /></div>
          </div>
          <div><label htmlFor="repeatDays">Flag the same lead again after (days)</label><input id="repeatDays" name="repeatDays" type="number" min={1} max={90} defaultValue={s.repeatDays} /></div>
        </fieldset>
        <fieldset>
          <legend>Sweeps</legend>
          <div><label htmlFor="sweepMode">Mode</label>
            <select id="sweepMode" name="sweepMode" defaultValue={s.sweepMode}><option value="off">Off</option><option value="preview">Preview: list the leads that would be swept</option><option value="live">Live: move them to the pond in Follow Up Boss</option></select></div>
          {s.sweepMode !== "live" && <label style={{ fontWeight: 400 }}><input type="checkbox" name="confirmSweep" value="yes" /> I have reviewed the sweep preview and want leads moved to the pond.</label>}
          <div className="row2">
            <div><label htmlFor="sweepAfterDays">Sweep after (days without contact)</label><input id="sweepAfterDays" name="sweepAfterDays" type="number" min={1} max={730} defaultValue={s.sweepAfterDays} /></div>
            <div><label htmlFor="maxSweepsPerRun">Most leads swept per run</label><input id="maxSweepsPerRun" name="maxSweepsPerRun" type="number" min={1} max={500} defaultValue={s.maxSweepsPerRun} /></div>
          </div>
          <div><label htmlFor="sweepPondId">Pond that receives swept leads</label>
            <select id="sweepPondId" name="sweepPondId" defaultValue={s.sweepPondId ?? ""}><option value="">None chosen (sweeps stay off)</option>{(report?.ponds ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {!report?.ponds?.length && <span className="hint">Your ponds appear here after the first audit.</span>}</div>
        </fieldset>
        <fieldset>
          <legend>Accountability standard</legend>
          <div className="row2">
            <div><label htmlFor="standardMaxNeglectedPct">Most neglected leads allowed (%)</label><input id="standardMaxNeglectedPct" name="standardMaxNeglectedPct" type="number" min={1} max={100} defaultValue={s.standardMaxNeglectedPct} /></div>
            <div><label htmlFor="standardMinResponsePct">New leads reached in time, minimum (%)</label><input id="standardMinResponsePct" name="standardMinResponsePct" type="number" min={0} max={100} defaultValue={s.standardMinResponsePct} /></div>
          </div>
          <div><label htmlFor="standardMinNewLeads">New leads needed before the response standard applies</label><input id="standardMinNewLeads" name="standardMinNewLeads" type="number" min={1} max={100} defaultValue={s.standardMinNewLeads} />
            <span className="hint">Agents below the standard are flagged on the scorecard. Nothing is changed in Follow Up Boss: pond access and lead flow stay your call.</span></div>
        </fieldset>
        <fieldset>
          <legend>Holding accounts</legend>
          <div><label htmlFor="holdingAccounts">Accounts that hold leads nobody is working <span className="hint">(one name per line, exactly as shown in Follow Up Boss)</span></label>
            <textarea id="holdingAccounts" name="holdingAccounts" rows={3} defaultValue={s.holdingAccounts.join("\n")} />
            <span className="hint">Any user whose name ends with an asterisk is already treated as a holding account. Leads in ponds, or with no agent, always count as unclaimed.</span></div>
        </fieldset>
        <div><button className="btn" type="submit">Save settings</button></div>
      </form>
    </Shell>
  );
}
