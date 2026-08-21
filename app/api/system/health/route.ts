import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "azurra-prospects",
    status: "ok",
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
    clockEngineMode: process.env.CLOCK_ENGINE_MODE ?? "shadow",
  });
}
