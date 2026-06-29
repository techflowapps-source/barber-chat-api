import { getHeader } from "h3";
import jwt from "jsonwebtoken";
import type { H3Event } from "h3";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-access-secret-change-in-production";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function error(message: string, status = 400) {
  return json({ message, statusCode: status }, status);
}

export function requireAuth(event: H3Event) {
  const header = getHeader(event, "authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");

  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}
