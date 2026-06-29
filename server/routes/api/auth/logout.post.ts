import { defineEventHandler, readBody } from "h3";
import { deleteRefreshTokens } from "../../../utils/supabase";
import { verifyRefresh } from "../../../utils/auth";
import { error, json } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ refreshToken?: string }>(event);
  const refreshToken = body?.refreshToken;

  if (!refreshToken) {
    return error("Refresh token obrigatório", 400);
  }

  try {
    const payload = verifyRefresh(refreshToken);
    await deleteRefreshTokens(payload.sub);
  } catch {
    // idempotente
  }

  return json({ ok: true });
});
