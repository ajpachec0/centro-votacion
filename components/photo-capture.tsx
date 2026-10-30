"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { saveDraftsAction } from "@/app/actions/records";
import { ReviewFlag } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OCR_MODEL_NOTE } from "@/lib/ocr/model";
import { parseOcrLines, type ParsedDraft } from "@/lib/ocr/parse";
import {
  describeModelProgress,
  loadRecognizer,
  recognizeCanvas,
  splitRecognizedText,
  type ModelProgress,
} from "@/lib/ocr/recognize";
import { cropCanvas, detectBlocks, enhanceCanvas, rotateCanvas, scaleCanvas, type LineBox } from "@/lib/ocr/segment";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, canConfirm, reviewWarnings } from "@/lib/domain/review";
import { ASSIGNMENT_LABELS, ROLE_LABELS } from "@/lib/domain/roles";
import {
  ASSIGNMENT_TYPES,
  ROLES,
  type AssignmentType,
  type Center,
  type Role,
} from "@/lib/domain/types";

type Draft = ParsedDraft & { localId: string; reviewed: boolean };

type QueuedImage = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  canvas: HTMLCanvasElement;
  previewUrl: string;
  status: "lista" | "procesando" | "revisar" | "error";
  message?: string;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

async function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No se pudo crear la vista previa."))), "image/jpeg", 0.85);
  });
  return URL.createObjectURL(blob);
}

function toDraft(parsed: ParsedDraft): Draft {
  return { ...parsed, localId: crypto.randomUUID(), reviewed: false };
}

export function PhotoCapture({ center }: { center: Center }) {
  const router = useRouter();
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [modelStatus, setModelStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLImageElement>(null);
  const active = images.find((image) => image.id === activeId) ?? null;

  const accepted = useMemo(() => ALLOWED_IMAGE_TYPES.join(","), []);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    const next: QueuedImage[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= 10) {
        setError("Puede procesar hasta 10 imágenes por lote para no agotar la memoria.");
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        setError(`«${file.name}» no es JPG, PNG ni WEBP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`«${file.name}» supera 8 MB.`);
        continue;
      }
      const bitmap = await createImageBitmap(file);
      const canvas = scaleCanvas(bitmap, bitmap.width, bitmap.height, 2200);
      bitmap.close();
      next.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        canvas,
        previewUrl: await canvasUrl(canvas),
        status: "lista",
      });
    }
    setImages((current) => [...current, ...next]);
    if (!activeId && next[0]) setActiveId(next[0].id);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    if (activeId === id) setActiveId(null);
  }

  async function rotateActive() {
    if (!active) return;
    const canvas = rotateCanvas(active.canvas, 1);
    const previewUrl = await canvasUrl(canvas);
    URL.revokeObjectURL(active.previewUrl);
    dragOrigin.current = null;
    setSelection(null);
    setImages((current) =>
      current.map((image) => (image.id === active.id ? { ...image, canvas, previewUrl, status: "lista", message: undefined } : image)),
    );
  }

  async function readLines(source: HTMLCanvasElement, boxes: LineBox[]): Promise<string[]> {
    await loadRecognizer((progress: ModelProgress) => {
      setModelStatus(describeModelProgress(progress));
    });
    const lines: string[] = [];
    for (const [index, box] of boxes.entries()) {
      setModelStatus(`Leyendo línea ${index + 1} de ${boxes.length}…`);
      const text = await recognizeCanvas(cropCanvas(source, box), "line");
      lines.push(...splitRecognizedText(text));
    }
    return lines;
  }

  async function processImage(image: QueuedImage) {
    setError("");
    setMessage("");
    setImages((current) => current.map((item) => (item.id === image.id ? { ...item, status: "procesando", message: undefined } : item)));
    try {
      const enhanced = enhanceCanvas(image.canvas);
      const context = enhanced.getContext("2d");
      if (!context) throw new Error("No se pudo leer la imagen.");
      const blocks = detectBlocks(context.getImageData(0, 0, enhanced.width, enhanced.height));
      const boxes = blocks.flatMap((block) => block.lines);
      let lines =
        boxes.length > 0 && boxes.length <= 40 ? await readLines(enhanced, boxes) : [];
      if (lines.join(" ").trim().length < 3) {
        setModelStatus("Leyendo la fotografía completa en español…");
        await loadRecognizer((progress: ModelProgress) => setModelStatus(describeModelProgress(progress)));
        lines = splitRecognizedText(await recognizeCanvas(enhanced, "page"));
      }
      if (lines.length === 0) {
        throw new Error("No se leyó texto. Rote la foto o marque con el recuadro la zona escrita.");
      }
      const produced = parseOcrLines(lines).map(toDraft);
      setDrafts((current) => [...current, ...produced]);
      setImages((current) =>
        current.map((item) =>
          item.id === image.id ? { ...item, status: "revisar", message: `${produced.length} bloque(s) para revisar.` } : item,
        ),
      );
      setActiveId(image.id);
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "El reconocimiento falló.";
      setImages((current) => current.map((item) => (item.id === image.id ? { ...item, status: "error", message: text } : item)));
      setError(text);
    }
  }

  async function processSelection() {
    if (!active || !selection || selection.width < 12 || selection.height < 12) {
      setError("Seleccione un bloque más grande sobre la foto.");
      return;
    }
    setError("");
    try {
      const crop = cropCanvas(enhanceCanvas(active.canvas), selection);
      setModelStatus("Leyendo el recorte en español…");
      await loadRecognizer((progress: ModelProgress) => setModelStatus(describeModelProgress(progress)));
      const lines = splitRecognizedText(await recognizeCanvas(crop, "block"));
      if (lines.length === 0) {
        throw new Error("No se leyó texto en el recuadro. Márquelo otra vez sobre las líneas escritas.");
      }
      const produced = parseOcrLines(lines).map(toDraft);
      setDrafts((current) => [...current, ...produced]);
      setMessage("El recorte se agregó a la revisión. Elimine los bloques que no sirvan.");
      dragOrigin.current = null;
      setSelection(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo reconocer el recorte.");
    }
  }

  function updateDraft(localId: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft)));
  }

  async function save(mode: "pending" | "confirmed") {
    const chosen = drafts.filter((draft) => (mode === "confirmed" ? draft.reviewed : true));
    if (chosen.length === 0) {
      setError(mode === "confirmed" ? "Marque los registros que ya revisó." : "No hay registros para guardar.");
      return;
    }
    const invalid = chosen.filter((draft) => !draft.role || !draft.reference || !draft.assignmentType);
    if (invalid.length > 0) {
      setError("Cada registro necesita rol, referencia y titular o suplente antes de guardarse.");
      return;
    }
    if (mode === "confirmed" && chosen.some((draft) => !canConfirm(draft))) {
      setError("Solo se confirman los registros con nombre, DUI y teléfono válidos. Guarde el resto como pendiente.");
      return;
    }
    const image = active ?? images[0];
    if (!image) {
      setError("Agregue la fotografía de origen antes de guardar.");
      return;
    }
    const result = await saveDraftsAction(center.id, {
      image: {
        id: image.id,
        originalFileName: image.fileName,
        mimeType: image.mimeType,
        size: image.size,
        processingStatus: "PROCESSED",
      },
      drafts: chosen.map((draft) => ({
        role: draft.role,
        reference: draft.reference,
        assignmentType: draft.assignmentType,
        name: draft.name,
        dui: draft.dui,
        phone: draft.phone,
        observations: draft.observations,
        reviewStatus: mode === "confirmed" ? "CONFIRMED" : "PENDING",
        sourceImageId: image.id,
      })),
    });
    if (!result.ok) {
      setError(result.message ?? "No se pudieron guardar los registros.");
      return;
    }
    setDrafts((current) => current.filter((draft) => !chosen.some((item) => item.localId === draft.localId)));
    setMessage(result.message ?? "Registros guardados.");
    setError("");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-border bg-info-soft px-4 py-3 text-sm text-info">
        <p>{OCR_MODEL_NOTE}</p>
        <p className="mt-2">
          La primera vez el navegador descarga el modelo de español. Las fotografías se leen en este equipo y no se envían al servidor.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Elegir imágenes
          <input
            type="file"
            accept={accepted}
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-border bg-card px-4 text-sm font-medium">
          Usar cámara
          <input
            type="file"
            accept={accepted}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {modelStatus ? <p className="text-sm text-muted-foreground">{modelStatus}</p> : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {images.map((image) => (
          <li key={image.id} className="rounded-xl border border-border bg-card p-3">
            <button type="button" className="block w-full text-left" onClick={() => setActiveId(image.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt="" className="max-h-48 w-full rounded-lg object-contain bg-muted" />
              <p className="mt-2 text-sm font-medium">{image.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {image.status === "lista" ? "Lista para reconocer" : image.message || image.status}
              </p>
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" className="h-9" onClick={() => void processImage(image)} disabled={image.status === "procesando"}>
                {image.status === "error" ? "Reintentar" : "Reconocer"}
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={() => removeImage(image.id)}>
                Quitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {active ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Recuadro manual</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void rotateActive()}>
                Rotar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  dragOrigin.current = null;
                  setSelection(null);
                }}
                disabled={!selection}
              >
                Quitar recuadro
              </Button>
              <Button type="button" onClick={() => void processSelection()} disabled={!selection || selection.width < 12 || selection.height < 12}>
                Leer recuadro
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Mantenga pulsado y arrastre para dibujar el recuadro sobre el texto. La foto se queda quieta. Suelte para terminar y pulse «Leer recuadro».
          </p>
          <div
            role="application"
            aria-label="Zona de recorte. Arrastre para dibujar un recuadro."
            className="relative cursor-crosshair touch-none overflow-hidden rounded-xl border border-border bg-muted select-none"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              const point = pointOnFrame(event, frameRef.current, active.canvas.width, active.canvas.height);
              dragOrigin.current = point;
              setSelection({ ...point, width: 0, height: 0 });
              if (event.currentTarget.setPointerCapture) {
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* Si el navegador no captura el puntero, el arrastre sigue dentro de la foto. */
                }
              }
            }}
            onPointerMove={(event) => {
              const origin = dragOrigin.current;
              if (!origin) return;
              event.preventDefault();
              const point = pointOnFrame(event, frameRef.current, active.canvas.width, active.canvas.height);
              setSelection({
                x: Math.min(origin.x, point.x),
                y: Math.min(origin.y, point.y),
                width: Math.abs(point.x - origin.x),
                height: Math.abs(point.y - origin.y),
              });
            }}
            onPointerUp={(event) => {
              try {
                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              } catch {
                /* La captura del puntero ya no está activa. */
              }
              dragOrigin.current = null;
              setSelection((current) => (current && current.width >= 12 && current.height >= 12 ? current : null));
            }}
            onPointerCancel={() => {
              dragOrigin.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={frameRef}
              src={active.previewUrl}
              alt="Fotografía para recortar. Arrastre para marcar un recuadro."
              draggable={false}
              className="pointer-events-none block h-auto w-full select-none"
            />
            {selection && selection.width > 2 && selection.height > 2 ? (
              <div
                className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(41,41,43,0.45)]"
                style={{
                  left: `${(selection.x / active.canvas.width) * 100}%`,
                  top: `${(selection.y / active.canvas.height) * 100}%`,
                  width: `${(selection.width / active.canvas.width) * 100}%`,
                  height: `${(selection.height / active.canvas.height) * 100}%`,
                }}
              />
            ) : null}
          </div>
        </section>
      ) : null}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Revisión</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDrafts((current) => [
                ...current,
                toDraft({
                  role: "",
                  reference: "",
                  assignmentType: "",
                  name: "",
                  dui: "",
                  phone: "",
                  observations: "Agregado manualmente durante la revisión.",
                  unrecognizedFields: ["nombre", "DUI", "teléfono"],
                }),
              ])
            }
          >
            Agregar registro
          </Button>
        </div>
        {drafts.length === 0 ? <p className="text-sm text-muted-foreground">Los bloques reconocidos aparecerán aquí, sin confirmarse solos.</p> : null}
        {drafts.map((draft, index) => {
          const warnings = reviewWarnings(draft);
          return (
            <article key={draft.localId} className="grid gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Bloque {index + 1}</h3>
                <ReviewFlag />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className={fieldClass} value={draft.role} onChange={(event) => updateDraft(draft.localId, { role: event.target.value as Role | "" })}>
                  <option value="">Rol no reconocido</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <Input value={draft.reference} onChange={(event) => updateDraft(draft.localId, { reference: event.target.value })} placeholder="JRV 1" className="h-10 text-base md:text-base" />
                <select
                  className={fieldClass}
                  value={draft.assignmentType}
                  onChange={(event) => updateDraft(draft.localId, { assignmentType: event.target.value as AssignmentType | "" })}
                >
                  <option value="">Titular o suplente</option>
                  {ASSIGNMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ASSIGNMENT_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <Input value={draft.name} onChange={(event) => updateDraft(draft.localId, { name: event.target.value })} placeholder="Nombre" className="h-10 text-base md:text-base" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={draft.dui} onChange={(event) => updateDraft(draft.localId, { dui: event.target.value })} placeholder="DUI 00000000-0" className="h-10 font-mono text-base md:text-base" />
                <Input value={draft.phone} onChange={(event) => updateDraft(draft.localId, { phone: event.target.value })} placeholder="Teléfono 0000-0000" className="h-10 font-mono text-base md:text-base" />
              </div>
              <Label className="text-sm text-muted-foreground">{draft.observations || "Sin observaciones del reconocimiento."}</Label>
              {warnings.length > 0 ? (
                <ul className="text-sm text-warning">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.reviewed}
                  onChange={(event) => updateDraft(draft.localId, { reviewed: event.target.checked })}
                />
                Ya revisé este registro
              </label>
              <div>
                <Button type="button" variant="outline" onClick={() => setDrafts((current) => current.filter((item) => item.localId !== draft.localId))}>
                  Eliminar bloque
                </Button>
              </div>
            </article>
          );
        })}
        {drafts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-10" onClick={() => void save("pending")}>
              Guardar todos como pendientes
            </Button>
            <Button type="button" className="h-10" onClick={() => void save("confirmed")}>
              Confirmar marcados
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function pointOnFrame(
  event: React.PointerEvent<HTMLDivElement>,
  image: HTMLImageElement | null,
  canvasWidth: number,
  canvasHeight: number,
) {
  const rect = (image ?? event.currentTarget).getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const x = ((event.clientX - rect.left) / rect.width) * canvasWidth;
  const y = ((event.clientY - rect.top) / rect.height) * canvasHeight;
  return {
    x: Math.min(canvasWidth, Math.max(0, x)),
    y: Math.min(canvasHeight, Math.max(0, y)),
  };
}
