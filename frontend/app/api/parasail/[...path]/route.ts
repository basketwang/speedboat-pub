const upstreamBaseUrl =
  process.env.PARASAIL_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_PARASAIL_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

const upstreamApiKey =
  process.env.PARASAIL_API_KEY ??
  process.env.NEXT_PUBLIC_PARASAIL_API_KEY ??
  "psk-mock-mockkey";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(`${upstreamBaseUrl}/${path.join("/")}`);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${upstreamApiKey}`);
  headers.set(
    "X-Correlation-Id",
    request.headers.get("X-Correlation-Id") ?? crypto.randomUUID()
  );
  headers.delete("host");

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : request.body,
    duplex: request.method === "GET" ? undefined : "half",
    cache: "no-store"
  } as RequestInit & { duplex?: "half" });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
