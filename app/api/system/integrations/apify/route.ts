import { NextResponse } from "next/server";
import { checkApifyConnection } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkApifyConnection();
  return NextResponse.json(status, { status: status.connected ? 200 : 503 });
}
