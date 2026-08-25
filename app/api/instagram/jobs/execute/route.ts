import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runInstagramSearch, type InstagramSearchItem } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

type JobInput = {
  query?: string;
  location?: string | null;
  min_followers?: number;
  max_followers?: number | null;
  result_limit?: number;
  profile_scope?: string;
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function publicUrl(value: unknown): string | null {
  const candidate = textValue(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeItem(item: InstagramSearchItem, jobId: string, organizationId: string) {
  const username = textValue(item.username);
  if (!username) return null;
  const externalUrls = Array.isArray(item.externalUrls) ? item.externalUrls : [];
  const website = textValue(item.externalUrl) ?? externalUrls.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    return publicUrl((entry as Record<string, unknown>).url);
  }).find(Boolean) ?? null;

  return {
    organization_id: organizationId,
    job_id: jobId,
    platform: "instagram",
    external_id: textValue(item.id),
    username,
    display_name: textValue(item.fullName),
    profile_url: publicUrl(item.url) ?? `https://www.instagram.com/${encodeURIComponent(username)}/`,
    avatar_url: textValue(item.profilePicUrlHD) ?? textValue(item.profilePicUrl),
    bio: textValue(item.biography),
    follower_count: numberValue(item.followersCount),
    following_count: numberValue(item.followsCount),
    is_private: item.private === true,
    is_verified: item.verified === true,
    public_email: textValue(item.businessEmail) ?? textValue(item.email),
    public_phone: textValue(item.businessPhoneNumber) ?? textValue(item.phoneNumber),
    public_website: publicUrl(website),
    category: textValue(item.businessCategoryName) ?? textValue(item.categoryName),
    location: textValue(item.businessAddress) ?? textValue(item.cityName),
    source_metadata: {
      is_business: item.isBusinessAccount === true,
      posts_count: numberValue(item.postsCount),
      search_term: textValue(item.searchTerm),
    },
    collected_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let jobId = "";
  try {
    const body = await request.json() as { jobId?: unknown };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!jobId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: job } = await admin.from("prospect_jobs").select("id,organization_id,platform,status,input,output").eq("id", jobId).maybeSingle();
  if (!job || job.platform !== "instagram") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: membership } = await admin.from("organization_members").select("role").eq("organization_id", job.organization_id).eq("user_id", auth.user.id).maybeSingle();
  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!["queued", "completed", "failed"].includes(job.status)) return NextResponse.json({ error: "invalid_status" }, { status: 409 });

  const { count: existingCount } = await admin.from("prospect_results").select("id", { count: "exact", head: true }).eq("job_id", job.id);
  if ((existingCount ?? 0) > 0) return NextResponse.json({ error: "already_executed" }, { status: 409 });

  const input = (job.input ?? {}) as JobInput;
  const query = input.query?.trim() ?? "";
  const limit = Math.max(1, Math.min(250, input.result_limit ?? 100));
  if (!query) return NextResponse.json({ error: "invalid_job" }, { status: 422 });

  await admin.from("prospect_jobs").update({ status: "running", shadow_mode: false, started_at: new Date().toISOString(), finished_at: null }).eq("id", job.id);

  try {
    const rawItems = await runInstagramSearch({ query, location: input.location, limit });
    const minFollowers = input.min_followers ?? 0;
    const maxFollowers = input.max_followers ?? null;
    const allowPrivateMetadata = input.profile_scope === "public_metadata";
    const normalized = rawItems
      .map((item) => normalizeItem(item, job.id, job.organization_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => allowPrivateMetadata || !item.is_private)
      .filter((item) => item.follower_count === null || (item.follower_count >= minFollowers && (maxFollowers === null || item.follower_count <= maxFollowers)))
      .slice(0, limit);

    if (normalized.length > 0) {
      const { error: insertError } = await admin.from("prospect_results").insert(normalized);
      if (insertError) throw new Error("result_persistence_failed");
      const { error: ledgerError } = await admin.from("credit_ledger").insert({
        organization_id: job.organization_id,
        job_id: job.id,
        entry_type: "consume",
        amount: -normalized.length,
        idempotency_key: `instagram-job:${job.id}:consume`,
        description: "Pesquisa de perfis públicos no Instagram",
        metadata: { result_count: normalized.length },
      });
      if (ledgerError) {
        await admin.from("prospect_results").delete().eq("job_id", job.id);
        throw new Error("credit_settlement_failed");
      }
    }

    const completedAt = new Date().toISOString();
    await admin.from("prospect_jobs").update({
      status: "completed",
      shadow_mode: false,
      finished_at: completedAt,
      output: {
        execution_mode: "active",
        decision: "allowed",
        requested_results: limit,
        collected_results: rawItems.length,
        qualified_results: normalized.length,
        credit_effect: normalized.length,
        private_content_access: false,
        executed_at: completedAt,
      },
    }).eq("id", job.id);
    await admin.from("audit_events").insert({
      organization_id: job.organization_id,
      actor_id: auth.user.id,
      event_type: "instagram.search.completed",
      subject_type: "prospect_job",
      subject_id: job.id,
      payload: { requested_results: limit, qualified_results: normalized.length, credit_effect: normalized.length },
    });

    return NextResponse.json({ success: true, resultCount: normalized.length, creditsConsumed: normalized.length });
  } catch {
    const failedAt = new Date().toISOString();
    await admin.from("prospect_jobs").update({
      status: "failed",
      shadow_mode: false,
      finished_at: failedAt,
      output: { execution_mode: "active", decision: "failed", credit_effect: 0, executed_at: failedAt },
    }).eq("id", job.id);
    await admin.from("audit_events").insert({
      organization_id: job.organization_id,
      actor_id: auth.user.id,
      event_type: "instagram.search.failed",
      subject_type: "prospect_job",
      subject_id: job.id,
      payload: { credit_effect: 0 },
    });
    return NextResponse.json({ error: "execution_failed" }, { status: 502 });
  }
}
