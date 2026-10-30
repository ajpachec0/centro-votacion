"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { saveRecordAction, type RecordState } from "@/app/actions/records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canConfirm, reviewWarnings } from "@/lib/domain/review";
import { ASSIGNMENT_LABELS, referenceOptions, ROLE_LABELS } from "@/lib/domain/roles";
import { ASSIGNMENT_TYPES, ROLES, type Assignment, type AssignmentType, type Center, type Role } from "@/lib/domain/types";

const fieldClass = "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  center: Center;
  record?: Assignment;
  initial?: { role: Role; reference: string; assignmentType: AssignmentType };
  existingDui: string[];
};

export function RecordForm({ center, record, initial, existingDui }: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<Role>(record?.role ?? initial?.role ?? "VIGILANTE");
  const [reference, setReference] = useState(record?.reference ?? initial?.reference ?? referenceOptions("VIGILANTE", center)[0] ?? "");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(
    record?.assignmentType ?? initial?.assignmentType ?? "TITULAR",
  );
  const [name, setName] = useState(record?.name ?? "");
  const [dui, setDui] = useState(record?.dui ?? "");
  const [phone, setPhone] = useState(record?.phone ?? "");
  const [observations, setObservations] = useState(record?.observations ?? "");
  const [keepSlot, setKeepSlot] = useState(false);
  const [state, setState] = useState<RecordState>({ ok: false });
  const [pending, setPending] = useState(false);
  const warnings = reviewWarnings({ name, dui, phone });
  const duplicate = dui.trim() !== "" && existingDui.includes(dui.trim()) && dui.trim() !== record?.dui;
  const options = referenceOptions(role, center);

  function onRoleChange(next: Role) {
    setRole(next);
    const nextOptions = referenceOptions(next, center);
    if (!nextOptions.includes(reference)) setReference(nextOptions[0] ?? "");
  }

  function focusNext(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLTextAreaElement) return;
    const form = event.currentTarget.closest("form");
    if (!form || !(event.target instanceof HTMLElement)) return;
    const fields = Array.from(form.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
      (field) => !field.hasAttribute("disabled"),
    );
    const index = fields.indexOf(event.target);
    const next = fields[index + 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  async function submit(reviewStatus: "PENDING" | "CONFIRMED") {
    if (reviewStatus === "CONFIRMED" && !canConfirm({ name, dui, phone, role, reference, assignmentType })) {
      setState({ ok: false, message: "Para confirmar, complete nombre, DUI y teléfono con el formato indicado." });
      return;
    }
    setPending(true);
    const formData = new FormData();
    if (record) formData.set("id", record.id);
    formData.set("centerId", center.id);
    formData.set("role", role);
    formData.set("reference", reference);
    formData.set("assignmentType", assignmentType);
    formData.set("name", name);
    formData.set("dui", dui);
    formData.set("phone", phone);
    formData.set("observations", observations);
    formData.set("reviewStatus", reviewStatus);
    const result = await saveRecordAction({ ok: false }, formData);
    setState(result);
    setPending(false);
    if (!result.ok) return;
    if (!record) {
      setName("");
      setDui("");
      setPhone("");
      setObservations("");
      nameRef.current?.focus();
    }
    if (!keepSlot && !record) {
      const currentIndex = options.indexOf(reference);
      const nextReference = options[currentIndex + 1];
      if (nextReference) setReference(nextReference);
    }
    router.refresh();
  }

  return (
    <form
      className="grid gap-4"
      onKeyDown={focusNext}
      onSubmit={(event) => {
        event.preventDefault();
        void submit("PENDING");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="role">Rol</Label>
          <select id="role" className={fieldClass} value={role} onChange={(event) => onRoleChange(event.target.value as Role)}>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reference">Referencia</Label>
          <input
            id="reference"
            list="reference-options"
            className={fieldClass}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <datalist id="reference-options">
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="assignmentType">Asignación</Label>
          <select
            id="assignmentType"
            className={fieldClass}
            value={assignmentType}
            onChange={(event) => setAssignmentType(event.target.value as AssignmentType)}
          >
            {ASSIGNMENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {ASSIGNMENT_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="person-name">Nombre completo</Label>
        <Input
          id="person-name"
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          autoComplete="off"
          className="h-10 text-base md:text-base"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
        {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="dui">DUI</Label>
          <Input
            id="dui"
            value={dui}
            onChange={(event) => setDui(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00000000-0"
            className="h-10 font-mono text-base md:text-base"
            aria-invalid={state.fieldErrors?.dui ? true : undefined}
          />
          {state.fieldErrors?.dui ? <p className="text-sm text-destructive">{state.fieldErrors.dui}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000-0000"
            className="h-10 font-mono text-base md:text-base"
            aria-invalid={state.fieldErrors?.phone ? true : undefined}
          />
          {state.fieldErrors?.phone ? <p className="text-sm text-destructive">{state.fieldErrors.phone}</p> : null}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="observations">Observaciones</Label>
        <Textarea
          id="observations"
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          className="min-h-20 text-base md:text-base"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={keepSlot} onChange={(event) => setKeepSlot(event.target.checked)} />
        Mantener el mismo puesto después de guardar
      </label>
      {warnings.length > 0 ? (
        <ul className="grid gap-1 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning" aria-live="polite">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {duplicate ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
          Este DUI ya está en otro registro del centro.
        </p>
      ) : null}
      {state.message ? (
        <p className={state.ok ? "text-sm text-success" : "text-sm text-destructive"} role="status">
          {state.message}
          {state.warning ? ` ${state.warning}` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" className="h-10 px-4" disabled={pending}>
          Guardar pendiente
        </Button>
        <Button
          type="button"
          className="h-10 px-4"
          disabled={pending || !canConfirm({ name, dui, phone, role, reference, assignmentType })}
          onClick={() => void submit("CONFIRMED")}
        >
          Guardar confirmado
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Enter pasa al siguiente campo. Un registro incompleto solo puede quedar pendiente.</p>
    </form>
  );
}
