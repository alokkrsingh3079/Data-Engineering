const retryableStatuses = new Set([502, 503, 504]);
const maxUpstreamAttempts = 5;

function canRetry(request) {
  return request.method === "GET"
    || request.method === "HEAD"
    || (request.method === "POST" && Boolean(request.headers.get("Idempotency-Key")));
}

function gatewayError(status = 502) {
  return Response.json(
    { error: "The API is temporarily unavailable. Please try again shortly." },
    { status }
  );
}

function normalizeGatewayResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (response.status < 500 || contentType.toLowerCase().includes("application/json")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");
  headers.delete("ETag");
  return Response.json(
    { error: "The API is temporarily unavailable. Please try again shortly." },
    { status: response.status, headers }
  );
}

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
      const retryable = canRetry(request);
      for (let attempt = 0; attempt < (retryable ? maxUpstreamAttempts : 1); attempt++) {
        try {
          const response = await fetch(new Request(target, request.clone()));
          if (!retryableStatuses.has(response.status) || attempt === maxUpstreamAttempts - 1 || !retryable) {
            return normalizeGatewayResponse(response);
          }
          await response.body?.cancel();
        } catch {
          if (attempt === maxUpstreamAttempts - 1 || !retryable) return gatewayError();
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
      return gatewayError();
    }

    return env.ASSETS.fetch(request);
  }
};