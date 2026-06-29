import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth-storage";

const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

export type Promotion = {
  id: string;
  title: string;
  message: string;
  status: "QUEUED" | "SENDING" | "COMPLETED" | "FAILED";
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; nome: string; email: string; role: string };
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = (await res.json()) as { accessToken: string };
  const currentRefresh = getRefreshToken();
  if (currentRefresh) setTokens(data.accessToken, currentRefresh);
  return data.accessToken;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = getAccessToken();

  const doRequest = (accessToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });

  let res = await doRequest(token);

  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    res = await doRequest(token);
  }

  if (res.status === 401) {
    clearTokens();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as {
        message?: string | string[];
        error?: { message?: string };
      };
      message =
        (Array.isArray(json.message) ? json.message.join(", ") : json.message) ??
        json.error?.message ??
        text;
    } catch {
      // mantém text
    }
    throw new Error(message || `Erro ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, senha: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
  } catch {
    throw new Error(
      `API indisponível (${API_URL}). Inicie o backend: cd backend && npm run start:dev`,
    );
  }

  if (!res.ok) {
    throw new Error("Email ou senha inválidos");
  }

  const data = (await res.json()) as LoginResponse;
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // idempotente
    }
  }
  clearTokens();
}

export function listPromotions(): Promise<Promotion[]> {
  return apiFetch<Promotion[]>("/promotions");
}

export function createPromotion(data: { title: string; message: string }) {
  return apiFetch<Promotion & { hint?: string }>("/promotions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "QR" | "CONNECTED" | "FAILED";

export type WhatsappSession = {
  id: string;
  sessionName: string;
  phone: string | null;
  profileName: string | null;
  profilePhoto: string | null;
  sessionStatus: SessionStatus;
  qrCode: string | null;
  connectedAt: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QrCodeResponse = {
  qr: string | null;
  dataUrl: string | null;
};

export function getSessionStatus(): Promise<WhatsappSession | null> {
  return apiFetch<WhatsappSession | null>("/session/status");
}

export function getSessionQrCode(): Promise<QrCodeResponse> {
  return apiFetch<QrCodeResponse>("/session/qrcode");
}

export function connectSession(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/session/connect", { method: "POST" });
}

export function reconnectSession(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/session/reconnect", { method: "POST" });
}

export function disconnectSession(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/session/disconnect", { method: "POST" });
}
