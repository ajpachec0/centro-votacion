"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/centros", label: "Centros" },
  { href: "/exportaciones", label: "Exportaciones" },
  { href: "/respaldo", label: "Respaldo" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="text-base font-semibold text-primary">
            Centros de votación
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="Principal">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-secondary text-primary" : "hover:bg-muted",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="h-10 px-4">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
