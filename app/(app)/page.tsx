import Link from "next/link";

import { CenterSearch } from "@/components/center-search";
import { CenterStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { publicError } from "@/lib/errors";
import { listCenters } from "@/lib/repositories/centers";

export default async function DashboardPage() {
  await requireUser();
  let centers: Awaited<ReturnType<typeof listCenters>> = [];
  try {
    centers = await listCenters();
  } catch (error) {
    throw publicError(error, "No se pudo consultar Redis. Revise la URL y el token en .env.local.");
  }
  const counts = {
    total: centers.length,
    pending: centers.filter((center) => center.status === "PENDING").length,
    progress: centers.filter((center) => center.status === "IN_PROGRESS").length,
    completed: centers.filter((center) => center.status === "COMPLETED").length,
  };
  const cards = [
    ["Centros", counts.total, "bg-card"],
    ["Pendientes", counts.pending, "bg-warning-soft"],
    ["En progreso", counts.progress, "bg-info-soft"],
    ["Completados", counts.completed, "bg-success-soft"],
  ] as const;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="text-sm text-muted-foreground">Capture, revise y exporte cada centro por separado.</p>
        </div>
        <Button render={<Link href="/centros/nuevo" />} className="h-10">
          Crear centro
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, className]) => (
          <article key={label} className={`rounded-xl border border-border p-4 ${className}`}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
          </article>
        ))}
      </div>
      <CenterSearch />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/centros" className="font-medium text-primary underline-offset-4 hover:underline">
          Ver todos los centros
        </Link>
        <Link href="/exportaciones" className="font-medium text-primary underline-offset-4 hover:underline">
          Ir a exportaciones
        </Link>
      </div>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Actualizados recientemente</h2>
        {centers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay centros. Cree el primero para empezar la captura.</p>
        ) : (
          <ul className="grid gap-2">
            {centers.slice(0, 8).map((center) => (
              <li key={center.id}>
                <Link href={`/centros/${center.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted">
                  <span>
                    <span className="block font-medium">{center.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {center.municipality}, {center.department} · {center.jrvCount} JRV
                    </span>
                  </span>
                  <CenterStatusBadge status={center.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
