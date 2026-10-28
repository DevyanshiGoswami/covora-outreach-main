"use server";
import { revalidatePath } from 'next/cache';
import { callOnboardingApi, isOnboardingOwner } from '@/lib/onboarding-api';
import { isUuid } from '@/lib/team';
import { IntegrationRequestError, type IntegrationActionState } from '@/lib/admin-integrations';
export async function manageIntegration(_previous: IntegrationActionState, form: FormData): Promise<IntegrationActionState> {
  if (!await isOnboardingOwner()) return { error:'Only an agency owner can manage integrations.' };
  const action = String(form.get('action') ?? '');
  const id = form.get('id'); const version = Number(form.get('version'));
  if (!isUuid(id) || !Number.isSafeInteger(version) || version<0 || !['save','check','remove'].includes(action)) return { error:'Refresh the integration and try again.' };
  const body: Record<string, unknown> = { action,id,version };
  if (action==='save') {
    const apiKey=form.get('apiKey'); const label=form.get('label'); const channel=form.get('channel');
    if (typeof apiKey!=='string' || apiKey.trim().length<8 || apiKey.length>4096 || /\s/.test(apiKey.trim()) || typeof label!=='string' || !label.trim() || label.length>100 || !['email','linkedin'].includes(String(channel))) return { error:'Enter a connection name and a valid API key.' };
    Object.assign(body,{channel,label:label.trim(),apiKey:apiKey.trim()});
    if (channel==='linkedin' && version===0) {
      const workspaceId=form.get('workspaceId');
      if (typeof workspaceId!=='string' || !workspaceId.trim() || workspaceId.length>200) return { error:'Enter the workspace ID for this connection.' };
      body.workspaceId=workspaceId.trim();
    }
  }
  try {
    const result=await callOnboardingApi('admin-integrations',body);
    if (result.ok!==true) throw new Error();
    for (const path of ['/agency','/settings','/agency/setup']) revalidatePath(path);
    if (action==='check' && result.verified!==true) return { error:'The saved connection could not be verified. Check the key and permissions, then update it if needed.' };
    return { message:action==='save' ? 'Connection verified and saved. It is now available in client workspace connections.' : action==='remove' ? 'Connection removed from Covora.' : 'Connection verified.' };
  } catch (error) {
    if (error instanceof IntegrationRequestError) return { error: error.message };
    return { error:action==='save' ? 'The connection could not be saved. Check the API key and workspace, finish any pending account sign-ins, then refresh before retrying.' : action==='remove' ? 'The connection could not be removed. Assigned connections must stay available to their clients; refresh to check its status.' : 'The connection check could not be completed. Refresh and try again.' };
  }
  finally { delete body.apiKey; form.delete('apiKey'); }
}
