import { getSessionStatus } from "./api-client";

/** Destino pós-login: WhatsApp se desconectado, promoções se conectado. */
export async function resolveAdminHomePath(): Promise<"/admin/whatsapp" | "/admin/promotions"> {
  try {
    const session = await getSessionStatus();
    return session?.sessionStatus === "CONNECTED" ? "/admin/promotions" : "/admin/whatsapp";
  } catch {
    return "/admin/whatsapp";
  }
}

export async function isWhatsappConnected(): Promise<boolean> {
  try {
    const session = await getSessionStatus();
    return session?.sessionStatus === "CONNECTED";
  } catch {
    return false;
  }
}
