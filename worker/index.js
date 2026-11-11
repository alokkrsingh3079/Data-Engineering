export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
      if (!env.API_ORIGIN) {
        return Response.json({ error: "API_ORIGIN is not configured" }, { status: 503 });
      }

      let apiOrigin;
      try {
        apiOrigin = new URL(env.API_ORIGIN);
      } catch {
        return Response.json({ error: "API_ORIGIN must be a valid URL" }, { status: 500 });
      }

      if (apiOrigin.protocol !== "https:" && apiOrigin.hostname !== "localhost") {
        return Response.json({ error: "API_ORIGIN must use HTTPS" }, { status: 500 });
      }

      const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin);
      let response = await fetch(new Request(target, request.clone()));
      if (response.status === 429 && response.headers.get("x-render-routing") === "hibernate-rate-limited") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        response = await fetch(new Request(target, request.clone()));
      }
      return response;
    }

    return env.ASSETS.fetch(request);
  }
};