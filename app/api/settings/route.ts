import { NextResponse } from "next/server";
import { clampSettings } from "@/lib/config";
import { getSettings } from "@/lib/scan";
import { putJSON } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const f = await req.formData();
  const current = await getSettings();
  const wantsLive = f.get("mode") === "live";
  // Going live writes notes into Follow Up Boss, so it needs the explicit confirmation tick.
  const mode = wantsLive && (current.mode === "live" || f.get("confirmLive") === "yes") ? "live" : "preview";
  const next = clampSettings({
    neglectedDays: Number(f.get("neglectedDays")),
    responseMinutes: Number(f.get("responseMinutes")),
    responseCounts: f.get("responseCounts") === "call" ? "call" : "call_or_text",
    clockStartHour: Number(f.get("clockStartHour")),
    clockEndHour: Number(f.get("clockEndHour")),
    excludedStages: String(f.get("excludedStages") ?? "").split(/\r?\n|,/),
    mode,
    alsoCreateTask: f.get("alsoCreateTask") === "on",
    repeatDays: Number(f.get("repeatDays")),
    maxNotesPerRun: Number(f.get("maxNotesPerRun")),
    maxNotesPerAgent: Number(f.get("maxNotesPerAgent")),
  });
  await putJSON("settings.json", next);
  const flag = wantsLive && mode !== "live" ? "needconfirm" : "saved";
  return NextResponse.redirect(new URL(`/settings?${flag}=1`, req.url), 303);
}
