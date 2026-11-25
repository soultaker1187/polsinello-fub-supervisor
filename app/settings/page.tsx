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
        <div><button className="btn" type="submit">Save settings</button></div>
      </form>
    </Shell>
  );
}
