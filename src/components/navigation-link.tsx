"use client";

import { useState, type ComponentProps } from "react";
import Link, { useLinkStatus } from "next/link";

function PendingHint() {
  const { pending } = useLinkStatus();
  return <>
    <span className="navigation-hint" data-pending={pending} aria-hidden="true" />
    <span className="sr-only" role="status">{pending ? "Loading…" : ""}</span>
  </>;
}

/** Prefetch the full dynamic destination on intent, without fetching every row's link. */
export function NavigationLink({ href, children, className, onMouseEnter, onFocus, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState<typeof href | null>(null);
  return <Link {...props} className={[className, "navigation-link"].filter(Boolean).join(" ")} href={href} prefetch={intent === href}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) setIntent(href); }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) setIntent(href); }}>
    {children}<PendingHint />
  </Link>;
}
