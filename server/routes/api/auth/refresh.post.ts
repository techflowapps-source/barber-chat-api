import { defineEventHandler, readBody } from "h3";
import { findUserById, listRefreshTokens } from "../../../utils/supabase";
import { compareToken, signAccess, verifyRefresh } from "../../../utils/auth";
import { error, json } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ refreshToken?: string }>(event);
  const refreshToken = body?.refreshToken;

  if (!refreshToken) {
    return error("Refresh token obrigatório", 400);
  }

  try {
    const payload = verifyRefresh(refreshToken);
    const tokens = await listRefreshTokens(payload.sub);
    const now = Date.now();

    let valid = false;
    for (const t of tokens) {
      if (new Date(t.expiresAt).getTime() <= now) continue;
      if (await compareToken(refreshToken, t.tokenHash)) {
        valid = true;
        break;
      }
    }
    if (!valid) return error("Refresh token inválido", 403);

    const user = await findUserById(payload.sub);
    if (!user) return error("Refresh token inválido", 403);

    return json({ accessToken: signAccess({ sub: user.id, role: user.role }) });
  } catch {
    return error("Refresh token inválido", 403);
  }
});
