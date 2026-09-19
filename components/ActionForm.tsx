"use client";

import { useActionState, type ReactNode } from "react";

export interface ActionResult {
  error?: string;
  ok?: string;
}

export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Thin wrapper around useActionState so every form shows inline success and
 * error messages returned by its server action.
 */
export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  submitClassName = "btn-primary",
  confirm,
  ...rest
}: {
  action: FormAction;
  children?: ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  confirm?: string;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "children" | "className">) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
      {state.error ? (
        <p className="alert-error mt-3" role="alert" data-testid="form-error">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="alert-success mt-3" role="status" data-testid="form-ok">
          {state.ok}
        </p>
      ) : null}
      <div className="mt-4">
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Inline button form for one-click actions (delete, approve, etc.). */
export function ActionButton({
  action,
  label,
  className = "btn-secondary",
  confirm,
  hidden = {},
}: {
  action: FormAction;
  label: string;
  className?: string;
  confirm?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending ? "…" : label}
      </button>
      {state.error ? <span className="ml-2 text-sm text-red-700">{state.error}</span> : null}
    </form>
  );
}
