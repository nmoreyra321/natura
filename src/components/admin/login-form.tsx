"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState } from "react";

import { signIn } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  const fields = state && !state.ok ? state.fields : undefined;
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <Field label="Usuario o correo" htmlFor="email" error={fields?.email}>
        <Input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={Boolean(fields?.email)}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fields?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fields?.password)}
        />
      </Field>
      {state && !state.ok && !fields ? (
        <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral-deep">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <LogIn className="size-5" aria-hidden="true" />}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
