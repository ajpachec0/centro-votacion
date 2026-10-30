import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-muted-foreground">Captura de centros</p>
        <h1 className="text-2xl font-semibold text-primary">Centros de votación</h1>
        <p className="text-sm text-muted-foreground">
          El acceso usa la contraseña configurada en el servidor. Los datos personales no salen de esta aplicación.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <LoginFields searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginFields({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const params = await searchParams;
  return <LoginForm from={params.from} />;
}
