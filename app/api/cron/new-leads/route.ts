import { checkNewLeads } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await checkNewLeads());
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
