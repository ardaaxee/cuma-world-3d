import { DurableObject } from "cloudflare:workers";

interface Env {
  ROOMS: DurableObjectNamespace;
  RATE_LIMITS: DurableObjectNamespace;
  CONTROL_TOKEN: string;
  RATE_HASH_SECRET: string;
  PUBLIC_BUILD_CHANNEL: string;
  MIN_CLIENT_BUILD: string;
  MAX_ROOM_TTL_SECONDS: string;
  LOOKUP_LIMIT_PER_MINUTE: string;
}

type RoomRecord = {
  relay_url: string;
  build: string;
  region: string;
  capacity: number;
  expires_at: number;
  updated_at: number;
};

type RateBucket = {
  count: number;
  reset_at: number;
};

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_BODY_BYTES = 4096;
const DEFAULT_ROOM_TTL_SECONDS = 150;
const encoder = new TextEncoder();

export class RoomDirectory extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/state") {
      const room = await this.ctx.storage.get<RoomRecord>("room");
      if (!room || room.expires_at <= Date.now()) {
        if (room) await this.ctx.storage.delete("room");
        return new Response(null, { status: 404 });
      }
      return json(room, 200, { "Cache-Control": "no-store" });
    }

    if (request.method === "PUT" && url.pathname === "/state") {
      const room = await request.json<RoomRecord>();
      await this.ctx.storage.put("room", room);
      await this.ctx.storage.setAlarm(room.expires_at);
      return json({ ok: true, expires_at: room.expires_at }, 200);
    }

    if (request.method === "POST" && url.pathname === "/heartbeat") {
      const current = await this.ctx.storage.get<RoomRecord>("room");
      if (!current) return new Response(null, { status: 404 });
      const body = await request.json<{ ttl_seconds: number }>();
      current.expires_at = Date.now() + Math.max(30, body.ttl_seconds) * 1000;
      current.updated_at = Date.now();
      await this.ctx.storage.put("room", current);
      await this.ctx.storage.setAlarm(current.expires_at);
      return json({ ok: true, expires_at: current.expires_at }, 200);
    }

    if (request.method === "DELETE" && url.pathname === "/state") {
      await this.ctx.storage.delete("room");
      await this.ctx.storage.deleteAlarm();
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.delete("room");
  }
}

export class RateLimiter extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const body = await request.json<{ limit: number; window_ms: number }>();
    const now = Date.now();
    const limit = clampInt(body.limit, 1, 240);
    const windowMs = clampInt(body.window_ms, 1000, 300000);
    let bucket = await this.ctx.storage.get<RateBucket>("bucket");

    if (!bucket || now >= bucket.reset_at) {
      bucket = { count: 0, reset_at: now + windowMs };
    }

    bucket.count += 1;
    await this.ctx.storage.put("bucket", bucket);

    const allowed = bucket.count <= limit;
    return json(
      {
        allowed,
        remaining: Math.max(0, limit - bucket.count),
        retry_after_ms: allowed ? 0 : Math.max(1, bucket.reset_at - now),
      },
      allowed ? 200 : 429,
      { "Cache-Control": "no-store" },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error("control-plane error", error);
      return json({ ok: false, error: "internal_error" }, 500);
    }
  },
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") {
    return withCommonHeaders(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      }),
    );
  }

  if (request.method === "GET" && path === "/health") {
    return json({ ok: true, service: "cuma-world-control-plane", version: 1 }, 200, {
      "Cache-Control": "public, max-age=30",
    });
  }

  if (request.method === "GET" && path === "/v1/config") {
    return json(
      {
        ok: true,
        channel: safeText(env.PUBLIC_BUILD_CHANNEL, 32) || "development",
        minimum_client_build: safeText(env.MIN_CLIENT_BUILD, 48) || "3.0.0-dev",
        room_code_length: ROOM_CODE_LENGTH,
        room_capacity: 2,
        relay_transport: "godot-websocket",
      },
      200,
      { "Cache-Control": "public, max-age=60" },
    );
  }

  const match = path.match(/^\/v1\/rooms\/([^/]+)(?:\/(heartbeat))?$/);
  if (!match) return json({ ok: false, error: "not_found" }, 404);

  const code = normalizeRoomCode(match[1]);
  const heartbeat = match[2] === "heartbeat";
  if (!code) return json({ ok: false, error: "invalid_room_code" }, 400);

  const roomStub = env.ROOMS.getByName(code);

  if (request.method === "GET" && !heartbeat) {
    const rate = await consumeLookupBudget(request, env);
    if (!rate.allowed) {
      return json(
        { ok: false, error: "rate_limited" },
        429,
        {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.max(1, Math.ceil(rate.retry_after_ms / 1000))),
        },
      );
    }

    const result = await roomStub.fetch("https://room.internal/state", { method: "GET" });
    if (result.status !== 200) {
      return json({ ok: false, error: "room_not_found" }, 404, { "Cache-Control": "no-store" });
    }
    const room = await result.json<RoomRecord>();
    return json(
      {
        ok: true,
        room: {
          relay_url: room.relay_url,
          build: room.build,
          region: room.region,
          capacity: room.capacity,
          expires_at: room.expires_at,
        },
      },
      200,
      { "Cache-Control": "no-store" },
    );
  }

  if (!(await isAuthorizedControlRequest(request, env))) {
    return json({ ok: false, error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
  }

  const maxTtl = clampInt(Number(env.MAX_ROOM_TTL_SECONDS || 21600), 60, 86400);

  if (request.method === "PUT" && !heartbeat) {
    const body = await readSmallJson(request);
    if (!body) return json({ ok: false, error: "invalid_body" }, 400);

    const relayUrl = normalizeRelayUrl(body.relay_url);
    if (!relayUrl) return json({ ok: false, error: "invalid_relay_url" }, 400);

    const ttlSeconds = clampInt(Number(body.ttl_seconds || DEFAULT_ROOM_TTL_SECONDS), 30, maxTtl);
    const record: RoomRecord = {
      relay_url: relayUrl,
      build: safeText(body.build, 48) || "unknown",
      region: safeRegion(body.region),
      capacity: clampInt(Number(body.capacity || 2), 1, 2),
      expires_at: Date.now() + ttlSeconds * 1000,
      updated_at: Date.now(),
    };

    await roomStub.fetch("https://room.internal/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    return json({ ok: true, expires_at: record.expires_at }, 201, { "Cache-Control": "no-store" });
  }

  if (request.method === "POST" && heartbeat) {
    const body = (await readSmallJson(request)) || {};
    const ttlSeconds = clampInt(Number(body.ttl_seconds || DEFAULT_ROOM_TTL_SECONDS), 30, maxTtl);
    const result = await roomStub.fetch("https://room.internal/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: ttlSeconds }),
    });
    if (result.status === 404) return json({ ok: false, error: "room_not_found" }, 404);
    return json({ ok: true }, 200, { "Cache-Control": "no-store" });
  }

  if (request.method === "DELETE" && !heartbeat) {
    await roomStub.fetch("https://room.internal/state", { method: "DELETE" });
    return new Response(null, { status: 204, headers: commonHeaders() });
  }

  return json({ ok: false, error: "method_not_allowed" }, 405);
}

async function consumeLookupBudget(
  request: Request,
  env: Env,
): Promise<{ allowed: boolean; retry_after_ms: number }> {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  if (!env.RATE_HASH_SECRET) return { allowed: false, retry_after_ms: 60000 };
  const key = await hmacHex(env.RATE_HASH_SECRET, ip);
  const stub = env.RATE_LIMITS.getByName(key);
  const limit = clampInt(Number(env.LOOKUP_LIMIT_PER_MINUTE || 24), 4, 120);
  const response = await stub.fetch("https://rate.internal/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, window_ms: 60000 }),
  });
  const data = await response.json<{ allowed: boolean; retry_after_ms: number }>();
  return {
    allowed: Boolean(data.allowed),
    retry_after_ms: clampInt(Number(data.retry_after_ms || 0), 0, 300000),
  };
}

async function isAuthorizedControlRequest(request: Request, env: Env): Promise<boolean> {
  if (!env.CONTROL_TOKEN) return false;
  const value = request.headers.get("Authorization") || "";
  if (!value.startsWith("Bearer ")) return false;
  const provided = value.slice(7).trim();
  if (!provided || provided.length > 512) return false;
  return await secureEqual(provided, env.CONTROL_TOKEN);
}

async function secureEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(a), sha256(b)]);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeRoomCode(value: string): string | null {
  const clean = value.toUpperCase().replace(/[-\s]/g, "");
  if (clean.length !== ROOM_CODE_LENGTH) return null;
  for (const char of clean) if (!ROOM_ALPHABET.includes(char)) return null;
  return clean;
}

function normalizeRelayUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value.trim());
    const localWs = url.protocol === "ws:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "wss:" && !localWs) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

function safeRegion(value: unknown): string {
  const region = safeText(value, 24);
  return /^[A-Za-z0-9_-]*$/.test(region) ? region : "";
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return withCommonHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...headers,
      },
    }),
  );
}

function commonHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
}

function withCommonHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of commonHeaders()) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
