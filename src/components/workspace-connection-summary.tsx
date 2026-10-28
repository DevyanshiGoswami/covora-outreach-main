'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Network } from 'lucide-react';
import { bindManagedConnection } from '@/app/settings/onboarding-actions';
import type { ConnectionChannel, ManagedConnections, OnboardingActionState } from '@/lib/onboarding';
import { useSettingsAction } from './settings-dialog';

export function WorkspaceConnectionSummary({ integrations, clientId }: { integrations: ManagedConnections; clientId: string }) {
  return <div className="workspace-connection-grid">
    {(['email', 'linkedin'] as const).map(channel => <WorkspaceConnectionCard key={`${clientId}:${channel}:${integrations.assignments?.[channel]?.optionId}:${integrations.assignments?.[channel]?.enabled}:${integrations.status[channel]}`} channel={channel} integrations={integrations} clientId={clientId} />)}
  </div>;
}

function WorkspaceConnectionCard({ integrations, channel, clientId }: { integrations: ManagedConnections; channel: ConnectionChannel; clientId: string }) {
  const router = useRouter();
  const assignment = integrations.assignments?.[channel];
  const available = Boolean(assignment?.enabled && integrations.status[channel]);
  const options = integrations.options.filter(option => option.channel === channel);
  const [selected, setSelected] = useState(assignment?.optionId ?? '');
  const [state, submit, pending] = useSettingsAction<OnboardingActionState>(async (previous, form) => {
    try { return await bindManagedConnection(previous, form); }
    catch { return { error: 'Your session or access changed. Refresh before trying again.' }; }
  }, {}, () => router.refresh());
  const choice = options.find(option => option.id === selected);
  const alreadyAssigned = Boolean(choice && choice.id === assignment?.optionId && available);
  const changed = Boolean(choice && choice.id !== assignment?.optionId);
  const Icon = channel === 'email' ? Mail : Network;
  const label = channel === 'email' ? 'Email' : 'LinkedIn';
  const status = !integrations.assignments ? 'Unavailable' : !assignment ? 'Not assigned' : !assignment.enabled ? 'Disabled' : available ? 'Assigned' : 'Needs attention';
  return <section className="workspace-connection-card" aria-label={`${label} workspace assignment`}>
    <div className="workspace-connection-heading"><span><Icon size={17} aria-hidden="true" />{label}</span><span className={`settings-status ${available ? 'account-status-connected' : assignment ? 'account-status-attention' : ''}`}>{status}</span></div>
    <strong>{assignment?.label ?? (integrations.assignments ? 'No connection assigned' : 'Assignment details unavailable')}</strong>
    <p>{!assignment ? 'Choose a connection below to assign it to this client.' : available ? 'Used for new account connections in this client workspace.' : !assignment.enabled ? 'This assignment is saved, but account connections are disabled.' : 'This assignment is saved, but its credentials are unavailable.'}</p>
    {options.length ? <form action={submit} className="workspace-connection-form">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="settings-field">{label} connection<select name="optionId" required value={selected} disabled={pending || !integrations.assignments} onChange={event => setSelected(event.target.value)}>
        <option value="" disabled>Select a connection</option>
        {options.map(option => <option key={option.id} value={option.id} disabled={!option.keyConfigured}>{option.label}{option.id === assignment?.optionId ? ' · Currently assigned' : ''}{!option.keyConfigured ? ' · Configuration needed' : ''}</option>)}
      </select></label>
      {changed && <p className="settings-help">{assignment ? 'The current assignment stays in place until you save this change.' : 'Save to assign this connection to the client.'}</p>}
      <div className="onboarding-actions"><button className="settings-button settings-button-primary" disabled={pending || !choice?.keyConfigured || alreadyAssigned || !integrations.assignments}>{pending ? 'Saving…' : alreadyAssigned ? 'Already assigned' : assignment && changed ? 'Change connection' : 'Assign connection'}</button></div>
      {state.error && <p className="settings-feedback settings-feedback-error" role="alert">{state.error}</p>}
      {state.message && <p className="settings-feedback" role="status">{state.message}</p>}
    </form> : <p>No {label.toLowerCase()} connections available. <Link href="/agency?tab=integrations">Add a connection in Integrations</Link>.</p>}
  </section>;
}
