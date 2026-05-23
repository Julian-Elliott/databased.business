"""
Tiny FastAPI proxy bound to port 8001.

Why this exists
---------------
The user's site is a pure Astro 5 + Cloudflare Workers project — there is
no Python/FastAPI backend in production. The /api/* endpoints (Stripe
checkout creation, checkout status) are Astro server endpoints that
compile to Cloudflare Worker functions for the live site.

For local development inside the Emergent preview environment, however,
the Kubernetes ingress is wired to route /api/* → port 8001 (where it
expects a FastAPI backend) and /* → port 3000 (where Astro is running).
Without something listening on 8001 the buy button 502s from the public
preview URL even though Astro is serving /api/* perfectly on port 3000.

This proxy resolves the mismatch by forwarding every request received
on port 8001 to the Astro dev server on port 3000 with the URL/headers
intact. In production on Cloudflare, this file is irrelevant — the
Worker handles /api/* natively, and there is no port 8001.
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response

ASTRO_ORIGIN = "http://localhost:3000"

app = FastAPI(title="databased.business · dev /api proxy")

# Long-lived httpx client — connections to localhost are cheap to reuse.
_client = httpx.AsyncClient(base_url=ASTRO_ORIGIN, timeout=30.0)


# Stripped headers we don't want to forward. httpx + hop-by-hop headers
# don't mix well over Kubernetes ingress.
_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


@app.get("/")
@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"ok": "true", "service": "astro-api-proxy"}


@app.api_route(
    "/api/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request) -> Response:
    # Re-build the upstream URL with original query string intact.
    upstream_path = f"/api/{full_path}"
    qs = request.url.query
    if qs:
        upstream_path = f"{upstream_path}?{qs}"

    body = await request.body()
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP
    }

    try:
        upstream = await _client.request(
            request.method,
            upstream_path,
            headers=headers,
            content=body,
        )
    except httpx.RequestError as exc:
        return Response(
            content=f'{{"error":"Astro upstream unreachable: {exc!s}"}}'.encode(),
            status_code=502,
            media_type="application/json",
        )

    response_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in _HOP_BY_HOP and k.lower() != "content-encoding"
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
