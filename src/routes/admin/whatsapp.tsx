import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  Plug,
  PlugZap,
  QrCode,
  RefreshCw,
  Unplug,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  connectSession,
  disconnectSession,
  getSessionQrCode,
  getSessionStatus,
  logout,
  reconnectSession,
  type SessionStatus,
} from "@/lib/api-client";
import { isAuthenticated } from "@/lib/auth-storage";

export const Route = createFileRoute("/admin/whatsapp")({
  head: () => ({
    meta: [{ title: "WhatsApp — Barbearia Admin" }],
  }),
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: WhatsappPage,
});

const STATUS_LABEL: Record<SessionStatus, string> = {
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando...",
  QR: "Aguardando QR Code",
  CONNECTED: "Conectado",
  FAILED: "Falha na conexão",
};

function statusVariant(status: SessionStatus) {
  if (status === "CONNECTED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "QR" || status === "CONNECTING") return "secondary" as const;
  return "outline" as const;
}

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function WhatsappPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    refetch: refetchStatus,
    isFetching: fetchingStatus,
  } = useQuery({
    queryKey: ["session-status"],
    queryFn: getSessionStatus,
    refetchInterval: (query) => {
      const status = query.state.data?.sessionStatus;
      if (!status || status === "CONNECTED") return 15_000;
      return 3_000;
    },
  });

  const status = session?.sessionStatus ?? "DISCONNECTED";
  const needsQr = status === "QR" || status === "CONNECTING";
  const prevStatus = useRef<SessionStatus | null>(null);

  useEffect(() => {
    if (status === "CONNECTED" && prevStatus.current && prevStatus.current !== "CONNECTED") {
      toast.success("WhatsApp conectado! Você já pode enviar promoções.", {
        action: {
          label: "Ir para promoções",
          onClick: () => void navigate({ to: "/admin/promotions" }),
        },
      });
    }
    prevStatus.current = status;
  }, [status, navigate]);

  const {
    data: qr,
    refetch: refetchQr,
    isFetching: fetchingQr,
  } = useQuery({
    queryKey: ["session-qrcode"],
    queryFn: getSessionQrCode,
    enabled: needsQr,
    refetchInterval: needsQr ? 3_000 : false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["session-status"] });
    void queryClient.invalidateQueries({ queryKey: ["session-qrcode"] });
  };

  const connectMutation = useMutation({
    mutationFn: connectSession,
    onSuccess: () => {
      toast.success("Iniciando conexão... Escaneie o QR Code no celular.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reconnectMutation = useMutation({
    mutationFn: reconnectSession,
    onSuccess: () => {
      toast.info("Reconectando sessão...");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectSession,
    onSuccess: () => {
      toast.success("WhatsApp desconectado.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const actionPending =
    connectMutation.isPending || reconnectMutation.isPending || disconnectMutation.isPending;

  async function handleLogout() {
    await logout();
    await navigate({ to: "/admin/login" });
  }

  async function handleRefresh() {
    await Promise.all([refetchStatus(), needsQr ? refetchQr() : Promise.resolve()]);
  }

  return (
    <AdminShell onLogout={handleLogout}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
            <p className="mt-1 text-muted-foreground">
              Conecte o número da barbearia para enviar lembretes e promoções automaticamente.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefresh()}
            disabled={fetchingStatus || fetchingQr}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${fetchingStatus || fetchingQr ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {status === "CONNECTED" ? (
                  <CheckCircle2 className="size-5 text-green-600" />
                ) : status === "FAILED" ? (
                  <WifiOff className="size-5 text-destructive" />
                ) : (
                  <Loader2
                    className={`size-5 ${needsQr ? "animate-spin text-muted-foreground" : ""}`}
                  />
                )}
                Status da sessão
              </CardTitle>
              <CardDescription>Sessão única da barbearia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Número</dt>
                      <dd className="font-medium">{formatPhone(session?.phone ?? null)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Perfil</dt>
                      <dd className="font-medium">{session?.profileName ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Conectado em</dt>
                      <dd className="text-right font-medium">
                        {formatDate(session?.connectedAt ?? null)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Último heartbeat</dt>
                      <dd className="text-right font-medium">
                        {formatDate(session?.lastHeartbeat ?? null)}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {status !== "CONNECTED" && (
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={actionPending || status === "CONNECTING" || status === "QR"}
                    className="gap-2"
                  >
                    <Plug className="size-4" />
                    Conectar
                  </Button>
                )}
                {(status === "CONNECTED" || status === "FAILED") && (
                  <Button
                    variant="secondary"
                    onClick={() => reconnectMutation.mutate()}
                    disabled={actionPending}
                    className="gap-2"
                  >
                    <PlugZap className="size-4" />
                    Reconectar
                  </Button>
                )}
                {status === "CONNECTED" && (
                  <Button
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={actionPending}
                    className="gap-2"
                  >
                    <Unplug className="size-4" />
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5" />
                QR Code
              </CardTitle>
              <CardDescription>
                {status === "CONNECTED"
                  ? "Sessão ativa — QR Code não necessário."
                  : "Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status === "CONNECTED" ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
                  <CheckCircle2 className="mb-3 size-12 text-green-600" />
                  <p className="font-medium">WhatsApp conectado</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Lembretes e promoções serão enviados por este número.
                  </p>
                </div>
              ) : qr?.dataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={qr.dataUrl}
                    alt="QR Code WhatsApp"
                    className="size-64 rounded-lg border bg-white p-2 shadow-sm"
                  />
                  <p className="text-center text-sm text-muted-foreground">
                    O QR Code atualiza automaticamente. Escaneie com o WhatsApp da barbearia.
                  </p>
                </div>
              ) : needsQr ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <Loader2 className="mb-3 size-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <QrCode className="mb-3 size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique em <strong>Conectar</strong> para gerar o QR Code.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <strong className="text-foreground">Importante:</strong> use o WhatsApp Business ou
            pessoal da barbearia. A sessão permanece ativa mesmo após reiniciar o servidor (dados
            salvos em volume Docker). Sem conexão, lembretes e promoções não serão enviados.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
