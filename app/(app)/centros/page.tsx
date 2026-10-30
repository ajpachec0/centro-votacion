import Link from "next/link";

import { CenterSearch } from "@/components/center-search";
import { CenterStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { publicError } from "@/lib/errors";
import { filterCenters, listCenters } from "@/lib/repositories/centers";

export default async function CentersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q = "" } = await searchParams;
  let centers: Awaited<ReturnType<typeof listCenters>> = [];
  try {
    centers = filterCenters(await listCenters(), q);
  } catch (error) {
    throw publicError(error, "No se pudo consultar los centros.");
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Centros</h1>
          <p className="text-sm text-muted-foreground">{centers.length} resultado(s)</p>
        </div>
        <Button render={<Link href="/centros/nuevo" />} className="h-10">
          Crear centro
        </Button>
      </div>
      <CenterSearch initial={q} />
      {centers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay centros que coincidan con la búsqueda.</p>
      ) : (
        <ul className="grid gap-2">
          {centers.map((center) => (
            <li key={center.id}>
              <Link href={`/centros/${center.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block font-medium">{center.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {center.municipality}, {center.department}
                    {center.code ? ` · ${center.code}` : ""} · {center.jrvCount} JRV
                  </span>
                </span>
                <CenterStatusBadge status={center.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
