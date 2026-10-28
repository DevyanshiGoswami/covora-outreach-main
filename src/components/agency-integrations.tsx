"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Network, Plus, ShieldCheck } from 'lucide-react';
import { SettingsDialog, useSettingsAction } from './settings-dialog';
import { manageIntegration } from '@/app/agency/integration-actions';
import type { AdminIntegration, AdminIntegrationData, IntegrationActionState } from '@/lib/admin-integrations';
import type { ConnectionChannel } from '@/lib/onboarding';

// These names are confined to the explicitly authorized agency-owner connector UI.
const providerNames = { email: "Instantly", linkedin: "HeyReach" };
type Dialog = { channel:ConnectionChannel; connection?:AdminIntegration; remove?:boolean; opener:string };
export function AgencyIntegrations({ data }: { data:AdminIntegrationData }) {
  const [dialog,setDialog]=useState<Dialog|null>(null);
  const [notice,setNotice]=useState('');
  return <section className="agency-integrations" aria-label="Outreach integrations">
    {notice && <p className="settings-feedback" role="status">{notice}</p>}
    {data.error ? <p className="settings-feedback settings-feedback-error" role="alert">{data.error}</p> : <div className="agency-client-grid">
      {(['email','linkedin'] as const).map(channel => {
        const connections=data.integrations.filter(row=>row.channel===channel);
        const Icon=channel==='email' ? Mail : Network;
        return <article className="agency-client-card integration-card" key={channel}>
          <header className="agency-card-heading"><span className="agency-avatar"><Icon size={22} aria-hidden="true" /></span><div><h2>{providerNames[channel]}</h2><p>{channel==='email' ? 'Email outreach' : 'LinkedIn outreach'}</p></div></header>
          <p className="integration-description">{channel==='email' ? 'Connect your email outreach workspace so people can authorize their Google Workspace or Microsoft 365 accounts.' : 'Connect your LinkedIn outreach workspace so people can connect their profiles.'}</p>
          {connections.map(connection=><IntegrationRow key={`${connection.id}:${connection.version}:${connection.checkedAt}`} connection={connection} onEdit={()=>setDialog({channel,connection,opener:`edit-${connection.id}`})} onRemove={()=>setDialog({channel,connection,remove:true,opener:`remove-${connection.id}`})} />)}
          {!connections.length && <p className="settings-help integration-empty">No connection configured.</p>}
          <div className="agency-card-footer"><button id={`connect-${channel}`} className="settings-button settings-button-primary" onClick={()=>setDialog({channel,opener:`connect-${channel}`})}><Plus size={16} aria-hidden="true" />{connections.length ? 'Add another connection' : `Connect ${providerNames[channel]}`}</button></div>
        </article>;
      })}
    </div>}
    <p className="integration-note"><ShieldCheck size={16} aria-hidden="true" />API keys are encrypted on the backend and cannot be viewed after saving. Only agency owners can manage these integrations.</p>
    <p className="settings-help">After saving, assign a connection directly in the Email or LinkedIn card under a client’s Accounts → People. Connecting an integration does not start outreach. Each LinkedIn workspace can currently be assigned to one client.</p>
    {dialog && <SettingsDialog title={dialog.remove ? 'Remove integration?' : `${dialog.connection ? 'Update' : 'Connect'} ${providerNames[dialog.channel]}`} description={dialog.remove ? 'This removes the saved connection from Covora. It does not delete the account at the service.' : 'Use an API key from your outreach account.'} returnFocusId={dialog.opener} onClose={()=>setDialog(null)}>
      <IntegrationForm channel={dialog.channel} connection={dialog.connection} remove={dialog.remove} onClose={()=>setDialog(null)} onSaved={setNotice} />
    </SettingsDialog>}
  </section>;
}
function IntegrationRow({connection,onEdit,onRemove}:{connection:AdminIntegration;onEdit:()=>void;onRemove:()=>void}) {
  const router=useRouter();
  const [state,submit,pending]=useSettingsAction<IntegrationActionState>(manageIntegration,{},()=>router.refresh());
  return <section className="integration-row">
    <div className="integration-row-heading"><strong>{connection.label}</strong><span className={`settings-status ${connection.checkError ? 'account-status-attention' : 'account-status-connected'}`}>{connection.checkError ? 'Needs attention' : 'Verified'}</span></div>
    <p className="settings-help">{connection.assigned ? 'Assigned to a client workspace' : 'Available to assign'} · Last checked {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(connection.checkedAt))} UTC</p>
    <form action={submit} className="onboarding-actions"><input type="hidden" name="id" value={connection.id}/><input type="hidden" name="version" value={connection.version}/><input type="hidden" name="action" value="check"/><button className="settings-button" disabled={pending}>{pending ? 'Checking…' : 'Check connection'}</button><button type="button" id={`edit-${connection.id}`} className="settings-button" disabled={pending} onClick={onEdit}>Update API key</button><button type="button" id={`remove-${connection.id}`} className="settings-button" disabled={pending||connection.assigned} title={connection.assigned ? 'Assigned connections cannot be removed.' : undefined} onClick={onRemove}>Remove</button></form>
    {state.error && <p className="settings-feedback settings-feedback-error" role="alert">{state.error}</p>}{state.message && <p className="settings-feedback" role="status">{state.message}</p>}
  </section>;
}
function IntegrationForm({channel,connection,remove=false,onClose,onSaved}:{channel:ConnectionChannel;connection?:AdminIntegration;remove?:boolean;onClose:()=>void;onSaved:(message:string)=>void}) {
  const router=useRouter(); const input=useRef<HTMLInputElement>(null);
  const [id]=useState(()=>connection?.id ?? crypto.randomUUID());
  const [state,submit,pending]=useSettingsAction<IntegrationActionState>(async (previous,form)=>{
    if (input.current) input.current.value='';
    try { return await manageIntegration(previous,form); }
    catch { return {error:'The change could not be confirmed. Refresh before trying again.'}; }
    finally { form.delete('apiKey'); }
  },{},message=>{router.refresh();onSaved(message);onClose();});
  return <form action={submit} autoComplete="off">
    <input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={connection?.version ?? 0}/><input type="hidden" name="channel" value={channel}/><input type="hidden" name="action" value={remove ? 'remove' : 'save'}/>
    <div className="settings-dialog-body">
      {state.error && <p className="settings-feedback settings-feedback-error" role="alert">{state.error}</p>}
      {remove ? <p>Remove <strong>{connection?.label}</strong>? Its saved API key will be deleted from Covora.</p> : <>
        <label className="settings-field">Connection name<input name="label" defaultValue={connection?.label ?? ''} placeholder="My outreach workspace" required maxLength={100}/></label>
        <label className="settings-field">{connection ? 'New API key' : 'API key'}<input ref={input} name="apiKey" type="password" autoComplete="new-password" required minLength={8} maxLength={4096} spellCheck={false}/></label>
        {channel==='linkedin' && !connection && <label className="settings-field">Workspace ID<input name="workspaceId" required maxLength={200} spellCheck={false}/><small>Enter the workspace associated with this API key.</small></label>}
        <p className="settings-help">{channel==='email' ? 'The key needs permission to read the current workspace and read/create sending accounts. We detect the workspace when verifying the key.' : 'Account Login API access is needed for people to connect their LinkedIn accounts. A valid API key alone does not confirm that feature is enabled.'}</p>
        {connection && <p className="settings-help">Use a replacement key for the same workspace. Finish pending account sign-ins before changing the key.</p>}
      </>}
    </div>
    <footer className="settings-dialog-footer"><button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button><button className={`settings-button ${remove ? 'settings-button-danger' : 'settings-button-primary'}`} disabled={pending}>{pending ? 'Checking…' : remove ? 'Remove connection' : 'Verify and save'}</button></footer>
  </form>;
}
