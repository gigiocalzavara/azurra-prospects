import { NextRequest } from "next/server";

type Raw = Record<string, unknown>;

function num(item: Raw, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}
function str(item: Raw, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return Response.json({ error: "APIFY_API_TOKEN não configurado." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const username = String(body?.username || "").trim().replace(/^@/, "");
  const limit = Math.max(6, Math.min(50, Number(body?.limit || 24)));
  if (!username) return Response.json({ error: "Informe o perfil." }, { status: 400 });

  const actor = process.env.APIFY_INSTAGRAM_CONTENT_ACTOR?.trim() || "apify~instagram-api-scraper";
  const endpoint = new URL(`https://api.apify.com/v2/actors/${actor}/run-sync-get-dataset-items`);
  endpoint.searchParams.set("clean", "true");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("maxItems", String(limit));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: limit,
        searchType: "user",
        searchLimit: 1,
        addParentData: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error?.type || `Apify retornou HTTP ${response.status}`;
      return Response.json({ error: message }, { status: response.status >= 500 ? 502 : response.status });
    }
    if (!Array.isArray(payload)) return Response.json({ error: "Resposta inesperada do coletor." }, { status: 502 });

    const rawItems = payload.filter((item): item is Raw => Boolean(item) && typeof item === "object");
    const viewValues = rawItems.map((item) => num(item, ["videoViewCount","videoPlayCount","videoViews","viewCount","viewsCount","views"])).filter((v) => v > 0);
    const avgViews = viewValues.length ? viewValues.reduce((a, b) => a + b, 0) / viewValues.length : 0;

    const items = rawItems.map((item) => {
      const views = num(item, ["videoViewCount","videoPlayCount","videoViews","viewCount","viewsCount","views"]);
      const likes = num(item, ["likesCount","likeCount","likes"]);
      const comments = num(item, ["commentsCount","commentCount","comments"]);
      const shares = num(item, ["sharesCount","shareCount","shares"]);
      const saves = num(item, ["savesCount","saveCount","saves"]);
      const ratio = avgViews > 0 && views > 0 ? views / avgViews : 1;
      const engagement = views > 0 ? (likes + comments + shares) / views : 0;
      const performanceScore = clamp(50 + 28 * Math.log2(Math.max(0.2, ratio)));
      const engagementScore = clamp(engagement * 700);
      const viralScore = Math.round((performanceScore * 0.82 + engagementScore * 0.18) * 10) / 10;

      const url = str(item, ["url","postUrl","permalink","inputUrl"]);
      const shortCode = str(item, ["shortCode","shortcode","code","id"]);
      const externalId = shortCode || url || crypto.randomUUID();
      const type = str(item, ["type","productType"]).toLowerCase();

      return {
        external_id: externalId,
        permalink: url || (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null),
        media_type: type.includes("reel") ? "reel" : type.includes("image") ? "image" : "video",
        caption: str(item, ["caption","text","description"]) || null,
        hook: null,
        thumbnail_url: str(item, ["displayUrl","thumbnailUrl","thumbnail","imageUrl"]) || null,
        published_at: str(item, ["timestamp","takenAt","postDate","publishedAt"]) || null,
        duration_seconds: num(item, ["videoDuration","duration","videoDurationSeconds"]) || null,
        views,
        likes,
        comments,
        shares,
        saves,
        viral_score: viralScore,
        growth_velocity: 0,
        metadata: {
          ownerUsername: str(item, ["ownerUsername","username"]),
          source: "apify",
          collectedBy: actor,
        },
      };
    }).filter((item) => item.external_id);

    const avgEngagement = items.length
      ? items.reduce((sum, item) => sum + ((item.likes + item.comments + item.shares) / Math.max(item.views, 1)), 0) / items.length * 100
      : 0;

    return Response.json({
      ok: true,
      username,
      count: items.length,
      avg_views: Math.round(avgViews),
      engagement_rate: Math.round(avgEngagement * 100) / 100,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na coleta.";
    return Response.json({ error: message }, { status: 502 });
  }
}
