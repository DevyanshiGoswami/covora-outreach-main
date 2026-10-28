"use client";

import { createContext, useActionState, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

const DialogPending = createContext<(pending: boolean) => void>(() => { });

export function useSettingsAction<State extends { message?: string; error?: string }>(
  action: (previous: Awaited<State>, form: FormData) => Promise<State>,
  initialState: Awaited<State>,
  onSuccess?: (message: string) => void,
) {
  const setPending = useContext(DialogPending);
  const result = useActionState<State, FormData>(async (previous: Awaited<State>, form: FormData) => {
    const next = await action(previous, form);
    if (next.message && !next.error) onSuccess?.(next.message);
    return next;
  }, initialState);
  const pending = result[2];
  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);
  return result;
}

export function SettingsDialog({ title, description, returnFocusId, onClose, children }: {
  title: string;
  description?: string;
  returnFocusId?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const heading = useId();
  const summary = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    element?.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [data-initial-focus]')?.focus();
    return () => {
      element?.close();
      const target = returnFocusId ? document.getElementById(returnFocusId) : null;
      (target ?? (opener?.isConnected ? opener : document.getElementById("main")))?.focus();
    };
  }, [returnFocusId]);
  return <dialog ref={dialog} className="settings-dialog" aria-labelledby={heading} aria-describedby={description ? summary : undefined} onCancel={(event) => {
    event.preventDefault();
    if (!pending) onClose();
  }} onClose={(event) => {
    // Strict Mode may reopen the dialog before an effect-cleanup close event arrives.
    if (!event.currentTarget.open && !pending) onClose();
  }}>
    <header className="settings-dialog-header">
      <div>
        <h2 id={heading}>
          {title}
        </h2>
        {description && <p id={summary}>
          {description}
        </p>}
      </div>
      <button type="button" className="settings-close" aria-label="Close dialog" disabled={pending} onClick={onClose}>
        <X size={19} />
      </button>
    </header>
    <DialogPending.Provider value={setPending}>
      {children}
    </DialogPending.Provider>
  </dialog>;
}

export function SettingsTabs<T extends string>({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return <div className="settings-tabs" role="tablist" aria-label={label}>
    {options.map((option, index) => <button
      key={option.value}
      id={`${id}-${option.value}`}
      type="button"
      role="tab"
      aria-selected={value === option.value}
      aria-controls={`${id}-panel`}
      tabIndex={value === option.value ? 0 : -1}
      onClick={() => onChange(option.value)}
      onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % options.length
          : event.key === "ArrowLeft" ? (index + options.length - 1) % options.length
            : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(options[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}
    >
      {option.label}{option.count !== undefined && <span className="settings-tab-count">
        {option.count}
      </span>}
    </button>)}
  </div>;
}
