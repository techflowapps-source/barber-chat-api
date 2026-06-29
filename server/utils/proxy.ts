import type { H3Event } from "h3";
import { getHeader, getMethod, readRawBody } from "h3";
import { error } from "./http";

export function getWhatsappApiBase(): string | null {
  const base = process.env.WHATSAPP_API_URL?.trim().replace(/\/$/, "");
  return base || null;
}

export async function proxyToNestApi(event: H3Event, path: string) {
  const base = getWhatsappApiBase();
  if (!base) {
    return error(
      "API WhatsApp não configurada (WHATSAPP_API_URL). Faça deploy do backend no Render.",
      503,
    );
  }

  const method = getMethod(event);
  const headers: Record<string, string> = {};
  const authorization = getHeader(event, "authorization");
  if (authorization) headers.authorization = authorization;

  const contentType = getHeader(event, "content-type");
  if (contentType) headers["content-type"] = contentType;

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const raw = await readRawBody(event);
    if (raw) body = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  }

  const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(target, { method, headers, body });

  const responseType = res.headers.get("content-type") ?? "application/json";
  const payload = await res.arrayBuffer();

  return new Response(payload, {
    status: res.status,
    headers: { "content-type": responseType },
  });
}
