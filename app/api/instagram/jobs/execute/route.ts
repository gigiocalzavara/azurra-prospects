import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { startInstagramSearch } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { jobId?: unknown };
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!jobId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: job } = await admin.from("prospect_jobs").select("id,organization_id,platform,status,input,output").eq("id", jobId).maybeSingle();
  if (!job || job.platform !== "instagram") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: membership } = await admin.from("organization_members").select("role").eq("organization_id", job.organization_id).eq("user_id", auth.user.id).maybeSingle();
  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const output = (job.output ?? {}) as Record<string, unknown>;
  if (job.status === "running" && typeof output.external_run_id === "string") return NextResponse.json({ success: true, status: "processing" }, { status: 202 });
  if (!["queued", "completed", "failed", "running"].includes(job.status)) return NextResponse.json({ error: "invalid_status" }, { status: 409 });
  const { count } = await admin.from("prospect_results").select("id", { count: "exact", head: true }).eq("job_id", job.id);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "already_executed" }, { status: 409 });

  const input = (job.input ?? {}) as { query?: string; location?: string | null; result_limit?: number };
  const query = input.query?.trim() ?? "";
  const limit = Math.max(1, Math.min(250, input.result_limit ?? 100));
  if (!query) return NextResponse.json({ error: "invalid_job" }, { status: 422 });

  try {
    const run = await startInstagramSearch({ query, location: input.location, limit });
    const startedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("prospect_jobs").update({
      status: "running",
      shadow_mode: false,
      started_at: startedAt,
      finished_at: null,
      output: { execution_mode: "active", decision: "processing", external_run_id: run.id, external_dataset_id: run.defaultDatasetId ?? null, requested_results: limit, credit_effect: 0, executed_at: startedAt },
    }).eq("id", job.id);
    if (updateError) throw new Error("job_update_failed");
    return NextResponse.json({ success: true, status: "processing" }, { status: 202 });
  } catch {
    await admin.from("prospect_jobs").update({ status: "failed", shadow_mode: false, finished_at: new Date().toISOString(), output: { execution_mode: "active", decision: "failed", credit_effect: 0 } }).eq("id", job.id);
    return NextResponse.json({ error: "execution_start_failed" }, { status: 502 });
  }
}
