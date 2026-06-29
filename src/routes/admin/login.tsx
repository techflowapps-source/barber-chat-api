import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api-client";
import { resolveAdminHomePath } from "@/lib/admin-routing";
import { clearTokens, isAuthenticated } from "@/lib/auth-storage";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Login — Barbearia Admin" }],
  }),
  beforeLoad: async () => {
    if (!isAuthenticated()) return;
    const to = await resolveAdminHomePath();
    throw redirect({ to });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, senha);
      if (data.user.role !== "ADMIN") {
        clearTokens();
        toast.error("Apenas administradores podem acessar o painel de promoções.");
        return;
      }
      toast.success(`Bem-vindo, ${data.user.nome}!`);
      const to = await resolveAdminHomePath();
      if (to === "/admin/whatsapp") {
        toast.info("Conecte o WhatsApp para enviar lembretes e promoções.");
      }
      await navigate({ to });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Painel Administrativo</CardTitle>
          <CardDescription>
            Entre para enviar promoções pelo WhatsApp aos clientes cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@barbearia.local"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">
              Voltar ao início
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
