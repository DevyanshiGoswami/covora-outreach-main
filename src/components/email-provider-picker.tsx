import { Check } from "lucide-react";
import type { EmailProvider } from "@/lib/onboarding";

export function EmailProviderLogo({ provider }: { provider: EmailProvider }) {
  return provider === "microsoft"
    ? <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#7fba00" d="M13 1h10v10H13z" /><path fill="#00a4ef" d="M1 13h10v10H1z" /><path fill="#ffb900" d="M13 13h10v10H13z" /></svg>
    : <svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true"><path fill="#4285f4" d="M43.61 24.46c0-1.36-.12-2.67-.35-3.93H24v7.44h11a9.4 9.4 0 0 1-4.08 6.18v5.14h6.62c3.87-3.56 6.07-8.81 6.07-14.83Z" /><path fill="#34a853" d="M24 44c5.51 0 10.13-1.83 13.5-4.96l-6.62-5.14C29.05 35.12 26.71 35.85 24 35.85c-5.32 0-9.83-3.59-11.44-8.42H5.72v5.3A20.4 20.4 0 0 0 24 44Z" /><path fill="#fbbc05" d="M12.56 27.43a12.3 12.3 0 0 1 0-7.78v-5.3H5.72a20.4 20.4 0 0 0 0 18.38l6.84-5.3Z" /><path fill="#ea4335" d="M24 11.23c3 0 5.69 1.03 7.81 3.06l5.86-5.86C34.12 5.12 29.5 3.08 24 3.08A20.4 20.4 0 0 0 5.72 14.35l6.84 5.3C14.17 14.82 18.68 11.23 24 11.23Z" /></svg>;
}

export function EmailProviderPicker({ selected, disabled, onSelect }: {
  selected: EmailProvider | null; disabled: boolean; onSelect: (provider: EmailProvider) => void;
}) {
  return <fieldset className="email-provider-picker" disabled={disabled}>
    <legend>Choose your email provider</legend>
    <div className="email-provider-options">{([
      ["google", "Google Workspace", "Your work email in Gmail"],
      ["microsoft", "Microsoft", "Microsoft 365 or Outlook"],
    ] as const).map(([value, title, description]) => <button type="button" key={value} aria-pressed={selected === value} data-initial-focus={value === "google" ? true : undefined}
      className={`email-provider-card ${selected === value ? "is-selected" : ""}`} onClick={() => onSelect(value)}>
      <span className="email-provider-logo"><EmailProviderLogo provider={value} /></span>
      <span className="email-provider-card-copy"><strong>{title}</strong><small>{description}</small></span>
      {selected === value && <Check className="email-provider-selected" size={16} aria-hidden="true" />}
    </button>)}</div>
  </fieldset>;
}
