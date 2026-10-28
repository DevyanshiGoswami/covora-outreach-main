import { isUuid } from './team';
import { connectionChannel, record, type ConnectionChannel } from './onboarding';
import { clientOperationalNote } from './client-copy';
export type AdminIntegration = { id: string; channel: ConnectionChannel; label: string; version: number; verifiedAt: string; checkedAt: string; checkError: boolean; assigned: boolean };
export type AdminIntegrationData = { integrations: AdminIntegration[]; error?: string };
export type IntegrationActionState = { message?: string; error?: string };
const integrationErrors: Record<string, string> = {
  key_rejected: 'The service rejected this API key (401). Copy an active API key from the intended workspace and try again.',
  provider_access_denied: 'The service denied API access (403). Check that API access is enabled for your account and key.',
  provider_rate_limited: 'The service is rate limiting requests (429). Wait a minute before trying again.',
  provider_unavailable: 'The service could not be reached or is temporarily unavailable. Try again shortly.',
  key_verification_failed: 'The API key could not be verified for this workspace. Check its permissions and workspace.',
};
export class IntegrationRequestError extends Error {}
/** Only fixed messages cross the action boundary; never upstream error text. */
export function integrationErrorFromResponse(value: unknown): IntegrationRequestError | null {
  if (!value || typeof value !== 'object' || !('code' in value) || typeof value.code !== 'string'
    || !Object.hasOwn(integrationErrors, value.code)) return null;
  return new IntegrationRequestError(integrationErrors[value.code]);
}
export function adminIntegrationsFromResponse(value: unknown): AdminIntegration[] {
  const rows = record(value).integrations;
  if (!Array.isArray(rows)) throw new Error('Invalid response');
  return rows.map(value => {
    const row = record(value);
    if (!isUuid(row.id) || typeof row.label !== 'string' || typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version<1
      || typeof row.verifiedAt !== 'string' || !Number.isFinite(Date.parse(row.verifiedAt)) || typeof row.checkedAt !== 'string' || !Number.isFinite(Date.parse(row.checkedAt))
      || typeof row.checkError !== 'boolean' || typeof row.assigned !== 'boolean') throw new Error('Invalid response');
    return { id:row.id, channel:connectionChannel(row.channel), label:clientOperationalNote(row.label,'Managed connection'), version:row.version,
      verifiedAt:row.verifiedAt, checkedAt:row.checkedAt, checkError:row.checkError, assigned:row.assigned };
  });
}
