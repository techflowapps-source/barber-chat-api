import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, MessageCircle, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barbearia — WhatsApp" },
      {
        name: "description",
        content: "Integração de agendamentos e promoções com WhatsApp para sua barbearia.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Scissors className="size-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Barbearia + WhatsApp
        </h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Agendamentos com lembrete automático 15 minutos antes e campanhas de promoção para todos
          os clientes cadastrados.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          <Card className="text-left">
            <CardHeader>
              <MessageCircle className="mb-2 size-8 text-primary" />
              <CardTitle className="text-lg">Lembretes automáticos</CardTitle>
              <CardDescription>
                O cliente recebe confirmação ao agendar e um lembrete 15 minutos antes do horário.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-left">
            <CardHeader>
              <Megaphone className="mb-2 size-8 text-primary" />
              <CardTitle className="text-lg">Promoções em massa</CardTitle>
              <CardDescription>
                O admin escreve a mensagem e envia para todos os clientes pelo painel.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Button asChild size="lg" className="mt-10 gap-2">
          <Link to="/admin/login">
            <Megaphone className="size-4" />
            Acessar painel admin
          </Link>
        </Button>

        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/admin/login" className="text-primary hover:underline">
            Conectar WhatsApp
          </Link>
          {" · "}
          Enviar promoções · Gerenciar sessão
        </p>

        <p className="mt-6 text-xs text-muted-foreground">
          API em <code className="rounded bg-muted px-1">/docs</code> · Swagger
        </p>
      </div>
    </div>
  );
}
