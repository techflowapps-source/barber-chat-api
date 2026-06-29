import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Megaphone, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createPromotion, listPromotions, logout, type Promotion } from "@/lib/api-client";
import { isWhatsappConnected } from "@/lib/admin-routing";
import { isAuthenticated } from "@/lib/auth-storage";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({
    meta: [{ title: "Promoções WhatsApp — Barbearia Admin" }],
  }),
  beforeLoad: async () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/admin/login" });
    }
    const connected = await isWhatsappConnected();
    if (!connected) {
      throw redirect({ to: "/admin/whatsapp" });
    }
  },
  component: PromotionsPage,
});

const STATUS_LABEL: Record<Promotion["status"], string> = {
  QUEUED: "Na fila",
  SENDING: "Enviando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
};

function statusVariant(status: Promotion["status"]) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "SENDING") return "secondary" as const;
  return "outline" as const;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function PromotionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState(
    "Olá {nome}! 🔥 Promoção especial na barbearia. Agende pelo site!",
  );

  const {
    data: promotions = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["promotions"],
    queryFn: listPromotions,
    refetchInterval: (query) => {
      const list = query.state.data;
      return list?.some((p) => p.status === "SENDING" || p.status === "QUEUED") ? 4000 : false;
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => createPromotion({ title: title.trim(), message: message.trim() }),
    onSuccess: (data) => {
      toast.success(data.hint ?? `Promoção enviada para ${data.totalTargets} cliente(s)!`);
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleLogout() {
    await logout();
    await navigate({ to: "/admin/login" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Informe um título para a promoção.");
      return;
    }
    if (message.trim().length < 5) {
      toast.error("A mensagem deve ter pelo menos 5 caracteres.");
      return;
    }
    sendMutation.mutate();
  }

  const previewMessage = message.replace(/\{nome\}/gi, "João");

  return (
    <AdminShell onLogout={handleLogout}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promoções WhatsApp</h1>
          <p className="mt-1 text-muted-foreground">
            Escreva a mensagem e envie automaticamente para todos os clientes cadastrados.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5" />
                Nova promoção
              </CardTitle>
              <CardDescription>
                Use <code className="rounded bg-muted px-1">{"{nome}"}</code> para personalizar com
                o nome de cada cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título (interno)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Promoção de Junho"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem WhatsApp</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Olá {nome}! Hoje corte + barba com desconto..."
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={sendMutation.isPending}>
                  <Megaphone className="size-4" />
                  {sendMutation.isPending ? "Enviando..." : "Enviar para todos os clientes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>Como o cliente verá no WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-[#e5ddd5] p-4">
                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm shadow-sm">
                  <p className="whitespace-pre-wrap text-[#111b21]">{previewMessage || "..."}</p>
                  <p className="mt-1 text-right text-[10px] text-[#667781]">
                    {new Date().toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Os envios são feitos com intervalo de alguns segundos entre cada cliente para
                proteger a conta do WhatsApp.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Histórico de envios</CardTitle>
              <CardDescription>Acompanhe o progresso das campanhas</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma promoção enviada ainda. Crie a primeira acima.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {p.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>{STATUS_LABEL[p.status]}</Badge>
                      </TableCell>
                      <TableCell>{p.sentCount}</TableCell>
                      <TableCell>{p.failedCount}</TableCell>
                      <TableCell>{p.totalTargets}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
