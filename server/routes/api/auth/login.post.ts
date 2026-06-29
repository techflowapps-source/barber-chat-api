import { defineEventHandler, readBody } from "h3";
import { createRefreshToken, findUserByEmail } from "../../../utils/supabase";
import { comparePassword, hashToken, signAccess, signRefresh } from "../../../utils/auth";
import { error, json } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ email?: string; senha?: string }>(event);
    const email = body?.email?.trim().toLowerCase();
    const senha = body?.senha ?? "";

    if (!email || !senha) {
      return error("Email e senha são obrigatórios", 400);
    }

    const user = await findUserByEmail(email);
    if (!user || !(await comparePassword(senha, user.senhaHash))) {
      return error("Credenciais inválidas", 401);
    }

    const accessToken = signAccess({ sub: user.id, role: user.role });
    const refreshToken = signRefresh({ sub: user.id });

    await createRefreshToken({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: await hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    return json({
      accessToken,
      refreshToken,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("login error", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return error(message, 500);
  }
});
