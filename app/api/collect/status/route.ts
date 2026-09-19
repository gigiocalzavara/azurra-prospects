export async function GET() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return Response.json({ configured: false, connected: false, status: "missing" });

  try {
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return Response.json({
      configured: true,
      connected: response.ok,
      status: response.ok ? "online" : response.status === 401 || response.status === 403 ? "auth_error" : "offline",
    });
  } catch {
    return Response.json({ configured: true, connected: false, status: "offline" });
  }
}
