import type { AssignmentType, Center, ExpectedSlot, Role } from "@/lib/domain/types";

export const ROLE_LABELS: Record<Role, string> = {
  JEFE_CENTRO: "Jefe de centro de votación",
  DELEGADO_JEM: "Delegado JEM",
  SUPERVISOR: "Supervisor",
  ORIENTADOR: "Orientador",
  MIEMBRO_MESA: "Miembro de mesa",
  VIGILANTE: "Vigilante",
};

export const ASSIGNMENT_LABELS: Record<AssignmentType, string> = {
  TITULAR: "Titular",
  SUPLENTE: "Suplente",
};

export const DEPARTMENTS = [
  "Ahuachapán",
  "Cabañas",
  "Chalatenango",
  "Cuscatlán",
  "La Libertad",
  "La Paz",
  "La Unión",
  "Morazán",
  "San Miguel",
  "San Salvador",
  "San Vicente",
  "Santa Ana",
  "Sonsonate",
  "Usulután",
] as const;

/**
 * Regla inicial, editable en este archivo si las instrucciones oficiales cambian.
 * Los puestos requeridos siguen la cantidad observada: un titular por cargo,
 * dos orientadores y un vigilante titular por JRV. El suplente se ofrece siempre,
 * y solo el de vigilante no es obligatorio para marcar el centro como completado
 * salvo que ya exista un registro pendiente. Los suplentes de jefe, delegado,
 * supervisor y miembro de mesa son opcionales para no bloquear centros que no
 * los usen. Vigilante suplente también queda disponible, pero no bloquea el
 * cierre: la cantidad observada dice un vigilante por JRV.
 */
const OPTIONAL_SUPLENTE_ROLES: ReadonlySet<Role> = new Set([
  "JEFE_CENTRO",
  "DELEGADO_JEM",
  "SUPERVISOR",
  "MIEMBRO_MESA",
  "VIGILANTE",
]);

export function supervisorQuota(jrvCount: number, override: number | null): number {
  if (override !== null) return override;
  if (jrvCount <= 0) return 0;
  return Math.ceil(jrvCount / 7);
}

export function expectedSlots(center: Pick<Center, "jrvCount" | "supervisorCount">): ExpectedSlot[] {
  const slots: ExpectedSlot[] = [];

  const add = (role: Role, reference: string, assignmentType: AssignmentType, required: boolean) => {
    slots.push({ role, reference, assignmentType, required });
  };

  const addPair = (role: Role, reference: string, suplenteRequired: boolean) => {
    add(role, reference, "TITULAR", true);
    add(role, reference, "SUPLENTE", suplenteRequired);
  };

  addPair("JEFE_CENTRO", "General", !OPTIONAL_SUPLENTE_ROLES.has("JEFE_CENTRO"));
  addPair("DELEGADO_JEM", "General", !OPTIONAL_SUPLENTE_ROLES.has("DELEGADO_JEM"));

  const supervisors = supervisorQuota(center.jrvCount, center.supervisorCount);
  for (let index = 1; index <= supervisors; index += 1) {
    addPair("SUPERVISOR", `Supervisor ${index}`, !OPTIONAL_SUPLENTE_ROLES.has("SUPERVISOR"));
  }

  add("ORIENTADOR", "Orientador 1", "TITULAR", true);
  add("ORIENTADOR", "Orientador 2", "TITULAR", true);

  for (let jrv = 1; jrv <= center.jrvCount; jrv += 1) {
    const reference = `JRV ${jrv}`;
    addPair("MIEMBRO_MESA", reference, !OPTIONAL_SUPLENTE_ROLES.has("MIEMBRO_MESA"));
    addPair("VIGILANTE", reference, !OPTIONAL_SUPLENTE_ROLES.has("VIGILANTE"));
  }

  return slots;
}

export function slotKey(slot: {
  role: string;
  reference: string;
  assignmentType: string;
}): string {
  return `${slot.role}|${slot.reference}|${slot.assignmentType}`;
}

export function slotLabel(slot: ExpectedSlot): string {
  const role = ROLE_LABELS[slot.role];
  if (slot.role === "ORIENTADOR") return slot.reference;
  return `${role} · ${slot.reference} · ${ASSIGNMENT_LABELS[slot.assignmentType]}`;
}

export function referenceOptions(
  role: Role,
  center: Pick<Center, "jrvCount" | "supervisorCount">,
): string[] {
  if (role === "JEFE_CENTRO" || role === "DELEGADO_JEM") return ["General"];
  if (role === "ORIENTADOR") return ["Orientador 1", "Orientador 2"];
  if (role === "SUPERVISOR") {
    const total = Math.max(1, supervisorQuota(center.jrvCount, center.supervisorCount));
    return Array.from({ length: total }, (_, index) => `Supervisor ${index + 1}`);
  }
  return Array.from({ length: center.jrvCount }, (_, index) => `JRV ${index + 1}`);
}

export function nextEmptySlot(
  center: Pick<Center, "jrvCount" | "supervisorCount">,
  occupied: ReadonlySet<string>,
): ExpectedSlot | null {
  return expectedSlots(center).find((slot) => slot.required && !occupied.has(slotKey(slot))) ?? null;
}
