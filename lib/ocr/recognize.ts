import { OCR_LANG } from "@/lib/ocr/model";
import { prepareOcrCanvas } from "@/lib/ocr/segment";

export type ModelProgress = {
  status: string;
  progress?: number;
};

export type OcrMode = "line" | "block" | "page";

const PAGE_MODE: Record<OcrMode, string> = {
  line: "7",
  block: "6",
  page: "11",
};

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text?: string } }>;
};

let workerPromise: Promise<OcrWorker> | null = null;
let currentMode: OcrMode | null = null;
let progressListener: ((progress: ModelProgress) => void) | undefined;

export function describeModelProgress(progress: ModelProgress): string {
  const percent =
    typeof progress.progress === "number" ? ` ${Math.round(Math.min(1, Math.max(0, progress.progress)) * 100)} %` : "";
  switch (progress.status) {
    case "loading tesseract core":
      return `Cargando el motor de lectura…${percent}`;
    case "initializing tesseract":
      return "Preparando el motor en español…";
    case "loading language traineddata":
      return `Descargando el modelo de español…${percent}`;
    case "initializing api":
      return "Iniciando la lectura en español…";
    case "recognizing text":
      return `Leyendo el texto en español…${percent}`;
    default:
      return "Preparando la lectura en español…";
  }
}

export async function loadRecognizer(onProgress?: (progress: ModelProgress) => void): Promise<OcrWorker> {
  if (onProgress) progressListener = onProgress;
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(OCR_LANG, 1, {
        logger: (message) => {
          progressListener?.({
            status: message.status,
            progress: typeof message.progress === "number" ? message.progress : undefined,
          });
        },
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return worker;
    })().catch(() => {
      workerPromise = null;
      currentMode = null;
      throw new Error("No se pudo cargar el modelo de español. La primera vez se descarga en este navegador.");
    });
  }
  return workerPromise;
}

export async function recognizeCanvas(canvas: HTMLCanvasElement, mode: OcrMode): Promise<string> {
  const worker = await loadRecognizer();
  if (currentMode !== mode) {
    await worker.setParameters({ tessedit_pageseg_mode: PAGE_MODE[mode] });
    currentMode = mode;
  }
  const minHeight = mode === "line" ? 96 : mode === "block" ? 180 : 0;
  const prepared = prepareOcrCanvas(canvas, minHeight);
  try {
    const result = await worker.recognize(prepared);
    return (result.data.text ?? "").replace(/\r/g, "").trim();
  } catch {
    throw new Error("No se pudo leer el texto en español.");
  }
}

export function splitRecognizedText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function resetRecognizer(): void {
  workerPromise = null;
  currentMode = null;
  progressListener = undefined;
}
