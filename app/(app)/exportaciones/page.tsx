import { ExportPanel } from "@/components/export-panel";
import { requireUser } from "@/lib/auth/guard";
import { publicError } from "@/lib/errors";
import { inspectTemplate, readMapping, readTemplateBuffer } from "@/lib/excel/storage";
import { listCenters } from "@/lib/repositories/centers";
import type { SheetInspection } from "@/lib/excel/types";

export default async function ExportsPage() {
  await requireUser();
  const centers = await listCenters();
  const template = await readTemplateBuffer();
  let mapping = null;
  let inspection: SheetInspection[] | null = null;
  let inspectionError: string | null = null;
  try {
    mapping = await readMapping();
    if (template) inspection = await inspectTemplate();
  } catch (error) {
    inspectionError = publicError(error, "No se pudo leer la plantilla.").message;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Exportaciones</h1>
        <p className="text-sm text-muted-foreground">
          Cada centro produce su propio Excel a partir de la plantilla original. Varios centros se descargan en un ZIP.
        </p>
      </div>
      <ExportPanel
        centers={centers}
        mapping={mapping}
        templateReady={template !== null}
        inspection={inspection}
        inspectionError={inspectionError}
      />
    </div>
  );
}
