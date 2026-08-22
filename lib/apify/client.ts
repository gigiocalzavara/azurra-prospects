const APIFY_API_BASE = "https://api.apify.com/v2";

export type ApifyConnectionStatus = {
  configured: boolean;
  connected: boolean;
  searchActor: string;
  profileActor: string;
  error?: "not_configured" | "authentication_failed" | "unavailable";
};

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
