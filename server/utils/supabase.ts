const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertConfig() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  }
}

function restHeaders(extra?: Record<string, string>) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Supabase HTTP ${res.status}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type DbUser = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  role: string;
};

export type DbWhatsappSession = {
  id: string;
  sessionName: string;
  phone: string | null;
  profileName: string | null;
  profilePhoto: string | null;
  sessionStatus: string;
  qrCode: string | null;
  connectedAt: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DbPromotion = {
  id: string;
  title: string;
  message: string;
  status: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
};

export type DbRefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/User?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
    { headers: restHeaders() },
  );
  const rows = await parseJson<DbUser[]>(res);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/User?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers: restHeaders() },
  );
  const rows = await parseJson<DbUser[]>(res);
  return rows[0] ?? null;
}

export async function createRefreshToken(data: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  assertConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/RefreshToken`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(data),
  });
  await parseJson(res);
}

export async function listRefreshTokens(userId: string): Promise<DbRefreshToken[]> {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/RefreshToken?userId=eq.${encodeURIComponent(userId)}&select=*`,
    { headers: restHeaders() },
  );
  return parseJson<DbRefreshToken[]>(res);
}

export async function deleteRefreshTokens(userId: string) {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/RefreshToken?userId=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: restHeaders({ Prefer: "return=minimal" }) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase HTTP ${res.status}`);
  }
}

export async function getWhatsappSession(sessionName: string): Promise<DbWhatsappSession | null> {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/WhatsappSession?sessionName=eq.${encodeURIComponent(sessionName)}&select=*&limit=1`,
    { headers: restHeaders() },
  );
  const rows = await parseJson<DbWhatsappSession[]>(res);
  return rows[0] ?? null;
}

export async function listPromotions(limit = 50): Promise<DbPromotion[]> {
  assertConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Promotion?select=*&order=createdAt.desc&limit=${limit}`,
    { headers: restHeaders() },
  );
  return parseJson<DbPromotion[]>(res);
}

export async function countContacts(): Promise<number> {
  assertConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/Contact?select=id`, {
    headers: restHeaders({ Prefer: "count=exact" }),
  });
  if (!res.ok) throw new Error(await res.text());
  const range = res.headers.get("content-range");
  if (!range) return 0;
  const total = range.split("/")[1];
  return Number(total) || 0;
}

export async function createPromotion(data: {
  id: string;
  title: string;
  message: string;
  status: string;
  totalTargets: number;
}) {
  assertConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/Promotion`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(data),
  });
  const rows = await parseJson<DbPromotion[]>(res);
  return rows[0];
}

export async function pingDatabase() {
  assertConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/User?select=id&limit=1`, {
    headers: restHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}
