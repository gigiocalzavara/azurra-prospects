import { NextResponse } from "next/server";
import { checkApifyConnection } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkApifyConnection();
  const publicStatus = {
    configured: status.configured,
    connected: status.connected,
    ...(status.error ? { error: status.error } : {}),
  };

  return NextResponse.json(publicStatus, { status: status.connected ? 200 : 503 });
}
