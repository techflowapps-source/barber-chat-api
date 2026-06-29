import { Link } from "@tanstack/react-router";
import { LogOut, Megaphone, MessageCircle, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type AdminShellProps = {
  children: ReactNode;
  onLogout: () => void;
  userName?: string;
};

export function AdminShell({ children, onLogout, userName }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Scissors className="size-5 text-primary" />
            <span>Barbearia Admin</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/whatsapp" className="gap-2">
                <MessageCircle className="size-4" />
                WhatsApp
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/promotions" className="gap-2">
                <Megaphone className="size-4" />
                Promoções
              </Link>
            </Button>
            {userName && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            )}
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
              <LogOut className="size-4" />
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
