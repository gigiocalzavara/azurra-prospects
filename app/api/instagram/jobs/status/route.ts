import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getInstagramSearchResults, getInstagramSearchRun, type InstagramSearchItem } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

function textValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function publicUrl(value: unknown): string | null {
  const candidate = textValue(value);
  if (!candidate) return null;
  try { const url = new URL(candidate); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
function normalizeItem(item: InstagramSearchItem, jobId: string, organizationId: string) {
  const username = textValue(item.username);
  if (!username) return null;
  const externalUrls = Array.isArray(item.externalUrls) ? item.externalUrls : [];
  const website = publicUrl(item.externalUrl) ?? externalUrls.map((entry) => entry && typeof entry === "object" ? publicUrl((entry as Record<string, unknown>).url) : null).find(Boolean) ?? null;
  return {
    organization_id: organizationId, job_id: jobId, platform: "instagram", external_id: textValue(item.id), username,
    display_name: textValue(item.fullName), profile_url: publicUrl(item.url) ?? `https://www.instagram.com/${encodeURIComponent(username)}/`,
    avatar_url: publicUrl(item.profilePicUrlHD) ?? publicUrl(item.profilePicUrl), bio: textValue(item.biography),
    follower_count: numberValue(item.followersCount), following_count: numberValue(item.followsCount), is_private: item.private === true,
    is_verified: item.verified === true, public_email: textValue(item.businessEmail) ?? textValue(item.email),
    public_phone: textValue(item.businessPhoneNumber) ?? textValue(item.phoneNumber), public_website: website,
    category: textValue(item.businessCategoryName) ?? textValue(item.categoryName), location: textValue(item.businessAddress) ?? textValue(item.cityName),
    source_metadata: { is_business: item.isBusinessAccount === true, posts_count: numberValue(item.postsCount), search_term: textValue(item.searchTerm) },
    collected_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const body = await request.json().catch(() => ({})) as { jobId?: unknown };
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!token || !jobId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "server_configuration_error" }, { status: 500 });
  }
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: job } = await admin.from("prospect_jobs").select("id,organization_id,platform,status,input,output,shadow_mode").eq("id", jobId).maybeSingle();
  if (!job || job.platform !== "instagram") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: membership } = await admin.from("organization_members").select("role").eq("organization_id", job.organization_id).eq("user_id", auth.user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (job.status === "completed" && !job.shadow_mode) {
    const output = (job.output ?? {}) as Record<string, unknown>;
    return NextResponse.json({ success: true, status: "completed", resultCount: Number(output.qualified_results ?? 0), creditsConsumed: Number(output.credit_effect ?? 0) });
  }

  const output = (job.output ?? {}) as Record<string, unknown>;
  const runId = typeof output.external_run_id === "string" ? output.external_run_id : "";
  if (!runId) {
    await admin.from("prospect_jobs").update({ status: "failed", finished_at: new Date().toISOString(), output: { ...output, decision: "failed", credit_effect: 0 } }).eq("id", job.id);
    return NextResponse.json({ error: "execution_interrupted" }, { status: 409 });
  }

  try {
    const run = await getInstagramSearchRun(runId);
    if (["READY", "RUNNING"].includes(run.status)) return NextResponse.json({ success: true, status: "processing" }, { status: 202 });
    if (run.status !== "SUCCEEDED") throw new Error("external_run_failed");
    const input = (job.input ?? {}) as { min_followers?: number; max_followers?: number | null; result_limit?: number; profile_scope?: string };
    const limit = Math.max(1, Math.min(250, input.result_limit ?? 100));
    const datasetId = run.defaultDatasetId ?? (typeof output.external_dataset_id === "string" ? output.external_dataset_id : "");
    if (!datasetId) throw new Error("dataset_missing");
    const rawItems = await getInstagramSearchResults(datasetId, limit);
    const normalized = rawItems.map((item) => normalizeItem(item, job.id, job.organization_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => input.profile_scope === "public_metadata" || !item.is_private)
      .filter((item) => item.follower_count === null || (item.follower_count >= (input.min_followers ?? 0) && (input.max_followers == null || item.follower_count <= input.max_followers)))
      .slice(0, limit);

    if (normalized.length > 0) {
      const { error: insertError } = await admin.from("prospect_results").upsert(normalized, { onConflict: "job_id,username", ignoreDuplicates: true });
      if (insertError) throw new Error("result_persistence_failed");
      const { error: ledgerError } = await admin.from("credit_ledger").insert({ organization_id: job.organization_id, job_id: job.id, entry_type: "consume", amount: -normalized.length, idempotency_key: `instagram-job:${job.id}:consume`, description: "Pesquisa de perfis públicos no Instagram", metadata: { result_count: normalized.length } });
      if (ledgerError && ledgerError.code !== "23505") { await admin.from("prospect_results").delete().eq("job_id", job.id); throw new Error("credit_settlement_failed"); }
    }
    const completedAt = new Date().toISOString();
    await admin.from("prospect_jobs").update({ status: "completed", shadow_mode: false, finished_at: completedAt, output: { execution_mode: "active", decision: "allowed", requested_results: limit, collected_results: rawItems.length, qualified_results: normalized.length, credit_effect: normalized.length, private_content_access: false, executed_at: completedAt } }).eq("id", job.id);
    await admin.from("audit_events").insert({ organization_id: job.organization_id, actor_id: auth.user.id, event_type: "instagram.search.completed", subject_type: "prospect_job", subject_id: job.id, payload: { requested_results: limit, qualified_results: normalized.length, credit_effect: normalized.length } });
    return NextResponse.json({ success: true, status: "completed", resultCount: normalized.length, creditsConsumed: normalized.length });
  } catch {
    await admin.from("prospect_jobs").update({ status: "failed", shadow_mode: false, finished_at: new Date().toISOString(), output: { execution_mode: "active", decision: "failed", credit_effect: 0 } }).eq("id", job.id);
    return NextResponse.json({ error: "execution_failed" }, { status: 502 });
  }
}
