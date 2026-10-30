"use client";

import { useState } from "react";
import { useActionState } from "react";

import { saveMappingAction, uploadTemplateAction, type TemplateState } from "@/app/actions/template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadFromResponse } from "@/lib/download";
import { ASSIGNMENT_LABELS, ROLE_LABELS } from "@/lib/domain/roles";
import { ASSIGNMENT_TYPES, ROLES, type AssignmentType, type Center, type Role } from "@/lib/domain/types";
import type { ExcelMapping, MappingEntry, SheetInspection } from "@/lib/excel/types";

const emptyState: TemplateState = { ok: false };
const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const emptyRow = (): MappingEntry => ({
  role: "VIGILANTE",
  reference: "JRV 1",
  assignmentType: "TITULAR",
  nameCell: "",
  duiCell: "",
  phoneCell: "",
});

export function ExportPanel({
  centers,
  mapping,
  templateReady,
  inspection,
  inspectionError,
}: {
  centers: Center[];
  mapping: ExcelMapping | null;
  templateReady: boolean;
  inspection: SheetInspection[] | null;
  inspectionError: string | null;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadTemplateAction, emptyState);
  const [mapState, mapAction, mapPending] = useActionState(saveMappingAction, emptyState);
  const [selected, setSelected] = useState<string[]>([]);
  const [includePending, setIncludePending] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [sheet, setSheet] = useState(mapping?.sheet ?? inspection?.[0]?.name ?? "");
  const [rows, setRows] = useState<MappingEntry[]>(mapping?.entries.length ? mapping.entries : [emptyRow()]);
  const [header, setHeader] = useState({
    centerName: mapping?.header.centerName ?? "",
    department: mapping?.header.department ?? "",
    municipality: mapping?.header.municipality ?? "",
    code: mapping?.header.code ?? "",
    jrvCount: mapping?.header.jrvCount ?? "",
  });

  const mappingJson = JSON.stringify({ sheet, header, entries: rows.filter((row) => row.nameCell && row.duiCell && row.phoneCell) }, null, 2);

  async function downloadOne(id: string) {
    setDownloadError("");
    try {
      const response = await fetch(`/api/centros/${id}/excel${includePending ? "?pendientes=1" : ""}`);
      await downloadFromResponse(response, "centro.xlsx");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "No se pudo descargar el Excel.");
    }
  }

  async function downloadZip() {
    setDownloadError("");
    if (selected.length === 0) {
      setDownloadError("Seleccione al menos un centro.");
      return;
    }
    try {
      const response = await fetch("/api/exportaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerIds: selected, includePending }),
      });
      await downloadFromResponse(response, "centros-votacion.zip");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "No se pudo crear el ZIP.");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Plantilla original</h2>
        <p className="text-sm text-muted-foreground">
          {templateReady
            ? "Hay una copia local de la plantilla. El archivo original no se modifica."
            : "Todavía no está la plantilla. Sin ella no se genera un Excel de reemplazo."}
        </p>
        <form action={uploadAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="template">Archivo .xlsx</Label>
            <Input id="template" name="template" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
          </div>
          <Button type="submit" className="h-10" disabled={uploadPending}>
            {uploadPending ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </form>
        {uploadState.message ? <p className={uploadState.ok ? "text-sm text-success" : "text-sm text-destructive"}>{uploadState.message}</p> : null}
        {inspectionError ? <p className="text-sm text-destructive">{inspectionError}</p> : null}
        {inspection?.map((item) => (
          <details key={item.name} className="rounded-lg bg-muted p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Hoja «{item.name}» · {item.rowCount} filas · {item.cells.length} celdas con texto
            </summary>
            {item.merges.length > 0 ? <p className="mt-2 text-muted-foreground">Combinadas: {item.merges.slice(0, 20).join(", ")}</p> : null}
            <ul className="mt-2 grid max-h-64 gap-1 overflow-auto font-mono">
              {item.cells.map((cell) => (
                <li key={`${item.name}-${cell.address}`}>
                  {cell.address}: {cell.value}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Mapeo de celdas</h2>
        <p className="text-sm text-muted-foreground">
          Escriba las direcciones que vio en la plantilla. DUI y teléfono se guardan como texto para conservar ceros y guiones.
        </p>
        <form action={mapAction} className="grid gap-3">
          <input type="hidden" name="mapping" value={mappingJson} />
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="sheet">Nombre de la hoja</Label>
            <Input id="sheet" value={sheet} onChange={(event) => setSheet(event.target.value)} className="h-10 text-base md:text-base" />
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {(
              [
                ["centerName", "Nombre del centro"],
                ["department", "Departamento"],
                ["municipality", "Municipio"],
                ["code", "Código"],
                ["jrvCount", "Cantidad de JRV"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={header[key]}
                  onChange={(event) => setHeader((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))}
                  placeholder="Opcional"
                  className="h-10 font-mono text-base md:text-base"
                />
              </div>
            ))}
          </div>
          {rows.map((row, index) => (
            <div key={`${row.role}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-6">
              <select className={fieldClass} value={row.role} onChange={(event) => updateRow(index, { role: event.target.value as Role })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Input value={row.reference} onChange={(event) => updateRow(index, { reference: event.target.value })} className="h-10 text-base md:text-base" />
              <select
                className={fieldClass}
                value={row.assignmentType}
                onChange={(event) => updateRow(index, { assignmentType: event.target.value as AssignmentType })}
              >
                {ASSIGNMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSIGNMENT_LABELS[type]}
                  </option>
                ))}
              </select>
              <Input value={row.nameCell} placeholder="Nombre" onChange={(event) => updateRow(index, { nameCell: event.target.value.toUpperCase() })} className="h-10 font-mono md:text-base" />
              <Input value={row.duiCell} placeholder="DUI" onChange={(event) => updateRow(index, { duiCell: event.target.value.toUpperCase() })} className="h-10 font-mono md:text-base" />
              <Input value={row.phoneCell} placeholder="Teléfono" onChange={(event) => updateRow(index, { phoneCell: event.target.value.toUpperCase() })} className="h-10 font-mono md:text-base" />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, emptyRow()])}>
              Agregar puesto
            </Button>
            <Button type="submit" className="h-10" disabled={mapPending}>
              {mapPending ? "Guardando…" : "Guardar mapeo"}
            </Button>
          </div>
          {mapState.message ? <p className={mapState.ok ? "text-sm text-success" : "text-sm text-destructive"}>{mapState.message}</p> : null}
        </form>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Descargar</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includePending} onChange={(event) => setIncludePending(event.target.checked)} />
          Incluir registros pendientes
        </label>
        {centers.length === 0 ? <p className="text-sm text-muted-foreground">Cree un centro antes de exportar.</p> : null}
        <ul className="grid gap-2">
          {centers.map((center) => (
            <li key={center.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(center.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked ? [...current, center.id] : current.filter((id) => id !== center.id),
                    )
                  }
                />
                {center.name} · {center.municipality}
              </label>
              <Button type="button" variant="outline" className="h-9" onClick={() => void downloadOne(center.id)}>
                Excel
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button type="button" className="h-10" onClick={() => void downloadZip()} disabled={selected.length === 0}>
            Descargar ZIP
          </Button>
        </div>
        {downloadError ? (
          <p className="text-sm text-destructive" role="alert">
            {downloadError}
          </p>
        ) : null}
      </section>
    </div>
  );

  function updateRow(index: number, patch: Partial<MappingEntry>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}
