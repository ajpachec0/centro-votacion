"use client";

import { useActionState } from "react";

import { createCenterAction, updateCenterAction, type FormState } from "@/app/actions/centers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEPARTMENTS } from "@/lib/domain/roles";
import type { Center } from "@/lib/domain/types";

const initialState: FormState = {};
const fieldClass = "h-10 text-base md:text-base";

export function CenterForm({ center }: { center?: Center }) {
  const action = center ? updateCenterAction : createCenterAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      {center ? <input type="hidden" name="id" value={center.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="department">Departamento</Label>
          <select
            id="department"
            name="department"
            defaultValue={center?.department ?? ""}
            required
            className={`${fieldClass} w-full rounded-lg border border-input bg-card px-2.5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`}
            aria-invalid={state.fieldErrors?.department ? true : undefined}
          >
            <option value="" disabled>
              Seleccione
            </option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          {state.fieldErrors?.department ? (
            <p className="text-sm text-destructive" role="alert">
              {state.fieldErrors.department}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="municipality">Municipio o distrito</Label>
          <Input
            id="municipality"
            name="municipality"
            defaultValue={center?.municipality ?? ""}
            required
            className={fieldClass}
            aria-invalid={state.fieldErrors?.municipality ? true : undefined}
          />
          {state.fieldErrors?.municipality ? (
            <p className="text-sm text-destructive" role="alert">
              {state.fieldErrors.municipality}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nombre del centro</Label>
        <Input
          id="name"
          name="name"
          defaultValue={center?.name ?? ""}
          required
          className={fieldClass}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
        {state.fieldErrors?.name ? (
          <p className="text-sm text-destructive" role="alert">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="code">Código interno</Label>
          <Input id="code" name="code" defaultValue={center?.code ?? ""} className={fieldClass} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="jrvCount">Cantidad de JRV</Label>
          <Input
            id="jrvCount"
            name="jrvCount"
            type="number"
            min={1}
            max={400}
            required
            defaultValue={center?.jrvCount ?? 1}
            className={fieldClass}
            aria-invalid={state.fieldErrors?.jrvCount ? true : undefined}
          />
          {state.fieldErrors?.jrvCount ? (
            <p className="text-sm text-destructive" role="alert">
              {state.fieldErrors.jrvCount}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="supervisorCount">Supervisores</Label>
          <Input
            id="supervisorCount"
            name="supervisorCount"
            type="number"
            min={0}
            max={200}
            defaultValue={center?.supervisorCount ?? ""}
            placeholder="Automático"
            className={fieldClass}
          />
          <p className="text-sm text-muted-foreground">
            Vacío usa el entero superior de JRV dividido entre 7.
          </p>
        </div>
      </div>
      {state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" className="h-10 px-4" disabled={pending}>
          {pending ? "Guardando…" : center ? "Guardar cambios" : "Crear centro"}
        </Button>
      </div>
    </form>
  );
}
