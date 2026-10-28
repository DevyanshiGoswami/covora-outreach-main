export type OutreachRole = "agency_owner" | "client_admin" | "client_member" | "client_viewer" | "operator";
export type PresentationMode = "live" | "preview";
export type WorkspaceChoice = { id: string; name: string; role: OutreachRole; presentationMode?: PresentationMode };
export type Workspace = {
  clientId: string | null;
  clientName: string;
  role: OutreachRole | null;
  clients: WorkspaceChoice[];
  enabled: boolean;
  presentationMode?: PresentationMode;
};
const roles: readonly string[] = ["agency_owner", "client_admin", "client_member", "client_viewer", "operator"];
export function canRequestSetup(role: OutreachRole | null): boolean {
  return role === "client_admin" || canManageSetup(role);
}
export function canManageSetup(role: OutreachRole | null): boolean {
  return role === "operator" || role === "agency_owner";
}
export function agencyWorkspaces(clients: WorkspaceChoice[]): WorkspaceChoice[] {
  return clients.filter((client) => canManageSetup(client.role));
}
/** Only the guarded membership projection is accepted; legacy identity roles confer no access. */
export function resolveWorkspace(rows: readonly { client_id: unknown; client_name: unknown; role: unknown; presentation_mode?: unknown }[], requestedClientId?: string): Workspace {
  const clients = rows.flatMap((row): WorkspaceChoice[] =>
    typeof row.client_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.client_id) && typeof row.client_name === "string" && typeof row.role === "string" && roles.includes(row.role)
      ? [{ id: row.client_id, name: row.client_name, role: row.role as OutreachRole, presentationMode: row.presentation_mode === "preview" ? "preview" : "live" }]
      : [],
  );
  const selected = requestedClientId ? clients.find((client) => client.id === requestedClientId) : clients[0];
  return { clientId: selected?.id ?? null, clientName: selected?.name ?? "Your workspace", role: selected?.role ?? null, clients, enabled: Boolean(selected), presentationMode: selected?.presentationMode ?? "live" };
}

/** Presentation mode is read from the current authorized membership, never a URL flag. */
export function isPreviewWorkspace(workspace: Workspace): boolean {
  return workspace.enabled && Boolean(workspace.clientId) && workspace.presentationMode === "preview";
}
export function canUseLiveWorkspace(workspace: Workspace, clientId: string): boolean {
  return workspace.enabled && workspace.clientId === clientId && !isPreviewWorkspace(workspace);
}
