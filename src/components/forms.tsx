"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translate";
import { Alert, cn } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({ children, className, pendingLabel, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={cn(className ?? "btn-primary")} {...rest}>
      {pending ? (pendingLabel ?? t("common.loading")) : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  const t = useT();
  if (state.error) return <Alert tone="danger">{t(state.error as MessageKey, state.vars)}</Alert>;
  if (state.message) return <Alert tone="success">{t(state.message as MessageKey, state.vars)}</Alert>;
  return null;
}

/**
 * A form bound to a server action returning ActionState. Shows translated
 * errors/success messages and optionally resets on success.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cn("space-y-4", className)}>
      <ActionMessage state={state} />
      {children}
    </form>
  );
}

export function ConfirmButton({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? "btn-secondary"}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
