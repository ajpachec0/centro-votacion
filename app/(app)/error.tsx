"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-6" role="alert">
      <h1 className="text-lg font-semibold">No se pudo completar la operación</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Ocurrió un error inesperado."}</p>
      <div>
        <Button type="button" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
