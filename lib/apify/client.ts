const APIFY_API_BASE = "https://api.apify.com/v2";

export type ApifyConnectionStatus = {
  configured: boolean;
  connected: boolean;
  searchActor: string;
  profileActor: string;
  error?: "not_configured" | "authentication_failed" | "unavailable";
};

export type InstagramSearchItem = Record<string, unknown>;
export type ExternalSearchRun = { id: string; status: string; defaultDatasetId?: string };

function getApifyConfig() {
  return {
    token: process.env.APIFY_API_TOKEN?.trim() ?? "",
    searchActor: process.env.APIFY_INSTAGRAM_SEARCH_ACTOR?.trim() || "apify~instagram-search-scraper",
    profileActor: process.env.APIFY_INSTAGRAM_PROFILE_ACTOR?.trim() || "apify~instagram-profile-scraper",
  };
}

export async function checkApifyConnection(): Promise<ApifyConnectionStatus> {
  const config = getApifyConfig();
  const baseStatus = {
    configured: Boolean(config.token),
    connected: false,
    searchActor: config.searchActor,
    profileActor: config.profileActor,
  };

  if (!config.token) return { ...baseStatus, error: "not_configured" };

  try {
    const response = await fetch(`${APIFY_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401 || response.status === 403) {
      return { ...baseStatus, error: "authentication_failed" };
    }
    if (!response.ok) return { ...baseStatus, error: "unavailable" };
    return { ...baseStatus, connected: true };
  } catch {
    return { ...baseStatus, error: "unavailable" };
  }
}

export async function startInstagramSearch(input: {
  query: string;
  location?: string | null;
  limit: number;
}): Promise<ExternalSearchRun> {
  const config = getApifyConfig();
  if (!config.token) throw new Error("search_engine_not_configured");

  const limit = Math.max(1, Math.min(250, input.limit));
  const search = [input.query, input.location].filter(Boolean).join(" ").trim();
  const endpoint = new URL(`${APIFY_API_BASE}/actors/${config.searchActor}/runs`);
  endpoint.searchParams.set("maxItems", String(limit));
  endpoint.searchParams.set("waitForFinish", "0");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      search,
      searchType: "user",
      searchLimit: limit,
      enhanceUserSearchWithFacebookPage: false,
      liveSearch: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 401 || response.status === 403) throw new Error("search_engine_authentication_failed");
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { type?: string } } | null;
    throw new Error(payload?.error?.type ? `search_engine_${payload.error.type.replaceAll("-", "_")}` : "search_engine_execution_failed");
  }
  const payload = await response.json() as { data?: ExternalSearchRun };
  if (!payload.data?.id) throw new Error("search_engine_invalid_response");
  return payload.data;
}

export async function getInstagramSearchRun(runId: string): Promise<ExternalSearchRun> {
  const config = getApifyConfig();
  if (!config.token) throw new Error("search_engine_not_configured");
  const response = await fetch(`${APIFY_API_BASE}/actor-runs/${encodeURIComponent(runId)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("search_engine_status_failed");
  const payload = await response.json() as { data?: ExternalSearchRun };
  if (!payload.data?.id) throw new Error("search_engine_invalid_response");
  return payload.data;
}

export async function getInstagramSearchResults(datasetId: string, limit: number): Promise<InstagramSearchItem[]> {
  const config = getApifyConfig();
  if (!config.token) throw new Error("search_engine_not_configured");
  const endpoint = new URL(`${APIFY_API_BASE}/datasets/${encodeURIComponent(datasetId)}/items`);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");
  endpoint.searchParams.set("limit", String(Math.max(1, Math.min(250, limit))));
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("search_engine_results_failed");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("search_engine_invalid_response");
  return data.filter((item): item is InstagramSearchItem => Boolean(item) && typeof item === "object");
}
