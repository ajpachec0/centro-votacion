import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteCenterButton } from "@/components/delete-center-button";
import { RecordTable } from "@/components/record-table";
import { CenterStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { progressSummary } from "@/lib/domain/progress";
import { expectedSlots, slotKey, slotLabel } from "@/lib/domain/roles";
import { publicError } from "@/lib/errors";
import { getCenter } from "@/lib/repositories/centers";
import { listRecords } from "@/lib/repositories/records";

export default async function CenterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let center: Awaited<ReturnType<typeof getCenter>> = null;
  try {
    center = await getCenter(id);
  } catch (error) {
    throw publicError(error, "No se pudo consultar el centro.");
  }
  if (!center) notFound();
  const records = await listRecords(center.id);
  const summary = progressSummary(center, records);
  const confirmed = new Set(records.filter((record) => record.reviewStatus === "CONFIRMED").map((record) => slotKey(record)));
  const missing = expectedSlots(center)
    .filter((slot) => slot.required && !confirmed.has(slotKey(slot)))
    .slice(0, 24);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">
            {center.municipality}, {center.department}
            {center.code ? ` · ${center.code}` : ""}
          </p>
          <h1 className="text-2xl font-semibold">{center.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{center.jrvCount} JRV</span>
            <CenterStatusBadge status={center.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href={`/centros/${center.id}/fotografias`} />} className="h-10">
            Subir fotografías
          </Button>
          <Button render={<Link href={`/centros/${center.id}/captura`} />} variant="outline" className="h-10">
            Captura manual
          </Button>
          <Button render={<Link href={`/centros/${center.id}/editar`} />} variant="outline" className="h-10">
            Editar
          </Button>
          <DeleteCenterButton id={center.id} name={center.name} />
        </div>
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Progreso</h2>
          <p className="text-sm text-muted-foreground">
            {summary.requiredFilled} de {summary.required} puestos requeridos
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-success" style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.percent}% de los puestos requeridos confirmados. Opcionales confirmados: {summary.optionalFilled} de {summary.optional}. Pendientes de revisión: {summary.pendingRecords}.
        </p>
        {summary.duplicateConfirmed ? (
          <p className="mt-2 text-sm text-warning">Hay puestos con más de un registro confirmado. Corrija el duplicado antes de exportar.</p>
        ) : null}
      </section>
      {missing.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Puestos requeridos sin confirmar</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {missing.map((slot) => (
              <li key={slotKey(slot)}>
                <Link
                  href={`/centros/${center.id}/captura?rol=${slot.role}&referencia=${encodeURIComponent(slot.reference)}&tipo=${slot.assignmentType}`}
                  className="block rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  {slotLabel(slot)}
                  {slot.required ? "" : " · opcional"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Los puestos requeridos ya tienen un registro confirmado.</p>
      )}
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Personas</h2>
          <Button render={<Link href={`/api/centros/${center.id}/excel`} />} variant="outline" className="h-10">
            Exportar Excel
          </Button>
        </div>
        <RecordTable center={center} records={records} />
      </section>
    </div>
  );
}
