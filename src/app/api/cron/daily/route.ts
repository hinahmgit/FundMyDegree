import { NextResponse, type NextRequest } from "next/server";
import { runScheduledJobs } from "@/lib/jobs";
import { env } from "@/lib/env";

/**
 * Scheduled maintenance: expires pledges and sends reminders. Call hourly
 * (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await runScheduledJobs());
}
