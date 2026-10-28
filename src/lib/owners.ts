import { isUuid, isInvitationToken } from "./team";
export type OwnerList = {
  userId: string;
  canRemoveOwners: boolean;
  owners: {
    userId: string;
    email: string;
    state: "active" | "suspended" | "revoked";
    version: number;
  }[];
  invitations: {
    id: string;
    email: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    expiresAt: string;
  }[];
};
export type OwnerOffer = {
  email: string;
  status: "pending" | "accepted";
  expiresAt: string;
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid owner response");
  return value as Record<string, unknown>;
}
export function ownerList(value: unknown): OwnerList {
  const r = record(value);
  if (
    !isUuid(r.userId) ||
    (r.canRemoveOwners !== undefined && typeof r.canRemoveOwners !== "boolean") ||
    !Array.isArray(r.owners) ||
    !Array.isArray(r.invitations)
  )
    throw new Error();
  for (const item of r.owners) {
    const o = record(item);
    if (
      !isUuid(o.userId) ||
      typeof o.email !== "string" ||
      !["active", "suspended", "revoked"].includes(String(o.state)) ||
      !Number.isSafeInteger(o.version) ||
      Number(o.version) < 1
    )
      throw new Error();
  }
  for (const item of r.invitations) {
    const i = record(item);
    if (
      !isUuid(i.id) ||
      typeof i.email !== "string" ||
      !["pending", "accepted", "revoked", "expired"].includes(
        String(i.status),
      ) ||
      !Number.isFinite(Date.parse(String(i.expiresAt)))
    )
      throw new Error();
  }
  return { ...r, canRemoveOwners: r.canRemoveOwners === true } as OwnerList;
}
export function ownerOffer(value: unknown): OwnerOffer {
  const r = record(value);
  if (
    typeof r.email !== "string" ||
    !["pending", "accepted"].includes(String(r.status)) ||
    !Number.isFinite(Date.parse(String(r.expiresAt)))
  )
    throw new Error();
  return r as OwnerOffer;
}
export function ownerInvitation(value: unknown) {
  const r = record(value);
  if (
    !isInvitationToken(r.token) ||
    !Number.isFinite(Date.parse(String(r.expiresAt))) ||
    !["new", "existing", "unavailable"].includes(String(r.accountStatus)) ||
    (r.loginToken !== null &&
      (typeof r.loginToken !== "string" ||
        !/^[A-Za-z0-9_-]{20,256}$/.test(r.loginToken)))
  )
    throw new Error();
  return r as {
    token: string;
    loginToken: string | null;
    expiresAt: string;
    accountStatus: "new" | "existing" | "unavailable";
  };
}
export function ownerInvitationLink(
  origin: string,
  token: string,
  loginToken: string | null,
) {
  if (
    !isInvitationToken(token) ||
    (loginToken !== null && !/^[A-Za-z0-9_-]{20,256}$/.test(loginToken))
  )
    throw new Error();
  const url = new URL("/owner-invite", origin);
  url.hash = new URLSearchParams({
    token,
    ...(loginToken ? { activate: loginToken } : {}),
  }).toString();
  return url.toString();
}
export type OwnerSession = {
  token: string;
  loginToken?: string;
  needsPassword?: boolean;
};
export function ownerStorageKey(projectUrl: string) {
  return `covora.owner-invite:${new URL(projectUrl).origin}`;
}
export function captureOwnerInvitation(
  fragment: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  replace: (path: string) => void,
  projectUrl: string,
): OwnerSession {
  const key = ownerStorageKey(projectUrl);
  if (fragment) {
    try {
      storage.removeItem(key);
      const m =
        /^#token=([a-f0-9]{64})(?:&activate=([A-Za-z0-9_-]{20,256}))?$/.exec(
          fragment,
        );
      if (!m) return { token: "" };
      const value = { token: m[1], ...(m[2] ? { loginToken: m[2] } : {}) };
      storage.setItem(key, JSON.stringify(value));
      return value;
    } finally {
      replace("/owner-invite");
    }
  }
  try {
    const r = JSON.parse(storage.getItem(key) ?? "{}");
    if (
      !isInvitationToken(r.token) ||
      (r.loginToken && !/^[A-Za-z0-9_-]{20,256}$/.test(r.loginToken))
    )
      return { token: "" };
    return {
      token: r.token,
      loginToken: r.loginToken,
      needsPassword: r.needsPassword === true,
    };
  } catch {
    return { token: "" };
  }
}
