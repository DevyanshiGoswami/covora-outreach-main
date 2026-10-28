export function agencyAccess(value: Record<string, unknown>) {
  const isOwner = value.isOwner === true;
  return { isOwner, canManageClients: isOwner && value.canManageClients === true };
}
