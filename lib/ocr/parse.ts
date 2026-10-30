import type { AssignmentType, Role } from "@/lib/domain/types";

export type ParsedDraft = {
  role: Role | "";
  reference: string;
  assignmentType: AssignmentType | "";
  name: string;
  dui: string;
  phone: string;
  observations: string;
  unrecognizedFields: string[];
};

const ROLE_PATTERNS: { role: Role; pattern: RegExp }[] = [
  { role: "JEFE_CENTRO", pattern: /jefe de centro/ },
  { role: "DELEGADO_JEM", pattern: /delegad[oa] jem/ },
  { role: "MIEMBRO_MESA", pattern: /miembro de mesa/ },
  { role: "VIGILANTE", pattern: /vigilante/ },
  { role: "ORIENTADOR", pattern: /orientador/ },
  { role: "SUPERVISOR", pattern: /supervisor/ },
];

export function foldText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function isHeaderLine(line: string): boolean {
  const folded = foldText(line);
  return /vigilante|orientador|supervisor|miembro de mesa|jefe de centro|delegado jem|propietario|suplente|titular/.test(
    folded,
  );
}

function detectRole(text: string): Role | "" {
  const folded = foldText(text);
  return ROLE_PATTERNS.find((item) => item.pattern.test(folded))?.role ?? "";
}

function detectAssignment(text: string): AssignmentType | "" {
  const folded = foldText(text);
  if (/\bsuplente\b/.test(folded)) return "SUPLENTE";
  if (/\b(propietario|titular)\b/.test(folded)) return "TITULAR";
  return "";
}

function detectReference(text: string, role: Role | ""): string {
  const folded = foldText(text);
  const jrv = folded.match(/\bjrv\s*(\d{1,3})\b/);
  if (jrv) return `JRV ${Number(jrv[1])}`;
  const orientador = folded.match(/\borientador\s*(\d{1,2})\b/);
  if (orientador) return `Orientador ${Number(orientador[1])}`;
  const supervisor = folded.match(/\bsupervisor\s*(\d{1,2})\b/);
  if (supervisor) return `Supervisor ${Number(supervisor[1])}`;
  if (role === "JEFE_CENTRO" || role === "DELEGADO_JEM") return "General";
  return "";
}

export function normalizeDui(raw: string): string {
  const compact = raw.replace(/\s/g, "");
  if (/^\d{8}-\d$/.test(compact)) return compact;
  if (/^\d{9}$/.test(compact)) return `${compact.slice(0, 8)}-${compact.slice(8)}`;
  return compact;
}

export function normalizePhone(raw: string): string {
  const compact = raw.replace(/\s/g, "");
  if (/^\d{4}-\d{4}$/.test(compact)) return compact;
  if (/^\d{8}$/.test(compact)) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1] ?? null;
}

function extractDui(text: string): string {
  const labeled = firstMatch(
    foldText(text).replace(/d\.u\.i\.?/g, "dui"),
    /dui\s*[:\-]?\s*(\d{8}-\d|\d{9}|\d{1,8}-?\d?)/,
  );
  if (labeled) return normalizeDui(labeled);
  const formatted = text.match(/\b(\d{8}-\d)\b/)?.[1];
  if (formatted) return formatted;
  const nine = text.match(/\b(\d{9})\b/)?.[1];
  if (nine) return normalizeDui(nine);
  return "";
}

function extractPhone(text: string, dui: string): string {
  const folded = foldText(text);
  const labeled = firstMatch(folded, /(?:telefono|celular|tel)\s*[:\-]?\s*(\d{4}-\d{4}|\d{8})/);
  if (labeled) return normalizePhone(labeled);
  const withoutDui = dui ? text.replace(dui, " ").replace(dui.replace("-", ""), " ") : text;
  const formatted = withoutDui.match(/\b(\d{4}-\d{4})\b/)?.[1];
  if (formatted) return formatted;
  const eight = withoutDui.match(/\b(\d{8})\b/)?.[1];
  if (eight) return normalizePhone(eight);
  return "";
}

function extractName(lines: string[], dui: string, phone: string): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (isHeaderLine(line)) {
      const folded = foldText(line);
      const remainder = folded
        .replace(/jefe de centro(?: de votacion)?|delegado jem|miembro de mesa|vigilante|orientador|supervisor|propietario|suplente|titular|jrv/g, " ")
        .replace(/\d+/g, " ")
        .trim();
      if (remainder.length < 3) continue;
    }
    let text = line;
    if (dui) text = text.replaceAll(dui, " ");
    if (phone) text = text.replaceAll(phone, " ");
    text = text.replace(/\b\d{8}-\d\b/g, " ").replace(/\b\d{4}-\d{4}\b/g, " ").replace(/\b\d{8,9}\b/g, " ");
    text = text.replace(/^\s*(nombre|dui|d\.u\.i\.?|tel[eé]fono|telefono|tel|celular)\s*[:\-]\s*/i, " ");
    const labelOnly = /^(nombre|dui|telefono|tel|celular)$/.test(
      foldText(text).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (labelOnly) continue;
    text = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]/g, " ").replace(/\s+/g, " ").trim();
    if (text.length >= 3 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/.test(text)) parts.push(text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function parseChunk(lines: string[]): ParsedDraft {
  const joined = lines.join("\n");
  const role = detectRole(joined);
  const assignmentType = detectAssignment(joined);
  const reference = detectReference(joined, role);
  const dui = extractDui(joined);
  const phone = extractPhone(joined, dui);
  const name = extractName(lines, dui, phone);
  const unrecognizedFields: string[] = [];
  if (!role) unrecognizedFields.push("rol");
  if (!reference) unrecognizedFields.push("referencia");
  if (!assignmentType && role !== "ORIENTADOR" && role !== "JEFE_CENTRO" && role !== "DELEGADO_JEM") {
    unrecognizedFields.push("titular o suplente");
  }
  if (!name) unrecognizedFields.push("nombre");
  if (!dui) unrecognizedFields.push("DUI");
  if (!phone) unrecognizedFields.push("teléfono");

  const resolvedAssignment: AssignmentType | "" =
    assignmentType || (role === "ORIENTADOR" || role === "JEFE_CENTRO" || role === "DELEGADO_JEM" ? "TITULAR" : "");

  return {
    role,
    reference,
    assignmentType: resolvedAssignment,
    name,
    dui,
    phone,
    observations: unrecognizedFields.length
      ? `Revisar: no se reconoció ${unrecognizedFields.join(", ")}.`
      : "",
    unrecognizedFields,
  };
}

function splitByRepeatedIdentity(lines: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let seenDui = false;
  for (const line of lines) {
    const startsAnother =
      seenDui && !isHeaderLine(line) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3}/.test(line) && !/\d{4}/.test(line);
    if (startsAnother && current.length > 0) {
      chunks.push(current);
      current = [line];
      seenDui = false;
    } else {
      current.push(line);
    }
    if (/\b\d{8}-\d\b|\b\d{9}\b/.test(line)) seenDui = true;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export function parseOcrLines(lines: string[]): ParsedDraft[] {
  const cleaned = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return [
      {
        role: "",
        reference: "",
        assignmentType: "",
        name: "",
        dui: "",
        phone: "",
        observations: "No se reconoció texto en el bloque.",
        unrecognizedFields: ["rol", "referencia", "nombre", "DUI", "teléfono"],
      },
    ];
  }

  const headerChunks: string[][] = [];
  let current: string[] = [];
  for (const line of cleaned) {
    const header = isHeaderLine(line);
    const hasBody = current.some((item) => !isHeaderLine(item));
    if (header && hasBody) {
      headerChunks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) headerChunks.push(current);

  return headerChunks.flatMap((chunk) => splitByRepeatedIdentity(chunk).map((part) => parseChunk(part)));
}
