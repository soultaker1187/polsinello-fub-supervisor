"use client";
import { useState } from "react";

const LABEL: Record<string, string> = { scanning: "Reading", grading: "Checking response times", notifying: "Preparing Needs A Call notes", done: "Finished", error: "Stopped with an error", locked: "Another run is in progress", not_configured: "Follow Up Boss key not added yet" };

export function RunButton({ endpoint = "/api/run", label = "Run audit now", noun = "contacts" }: { endpoint?: string; label?: string; noun?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    let force = true;
    try {
      for (let i = 0; i < 80; i++) {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
        force = false;
        const s = await res.json();
        const progress = s.phase === "scanning" ? ` ${noun}${s.count ? ` (${s.count.toLocaleString("en-CA")}${s.total ? ` of ${s.total.toLocaleString("en-CA")}` : ""})` : ""}` : "";
        setMsg((LABEL[s.phase] ?? s.phase) + progress + (s.error ? `: ${s.error}` : ""));
        if (["done", "error", "not_configured"].includes(s.phase)) break;
        if (s.phase === "locked") await new Promise((r) => setTimeout(r, 8000));
      }
      window.location.reload();
    } catch {
      setMsg("The run could not be started. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
      <button className="btn" onClick={run} disabled={busy}>{busy ? "Running…" : label}</button>
      <span className="muted" aria-live="polite">{msg}</span>
    </span>
  );
}
