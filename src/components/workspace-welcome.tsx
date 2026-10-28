import Link from "next/link";
import { ArrowRight, Layers3, Mail, MessagesSquare } from "lucide-react";
import type { WorkspaceInfo } from "@/lib/model";
import { canManageTeam } from "@/lib/team";

const steps = [
  { title: "Account setup", description: "Work with Covora on the accounts you’ll use for outreach. Follow setup requests in Accounts.", icon: Mail },
  { title: "Campaign preparation", description: "Align with your Covora team on your audience and messages before outreach begins.", icon: Layers3 },
  { title: "Conversations and results", description: "Once outreach is running and activity syncs, review your conversations and campaign results here.", icon: MessagesSquare },
];

export function WorkspaceWelcome({ workspace, demo = false }: { workspace: WorkspaceInfo; demo?: boolean }) {
  if (!workspace.enabled || !workspace.clientId || !workspace.role) return null;
  const base = demo ? "/demo" : "";
  const query = `?${new URLSearchParams({ client: workspace.clientId })}`;
  return <section className="workspace-welcome" aria-labelledby="workspace-welcome-title">
    <div className="welcome-intro">
      <span className="eyebrow">YOUR OUTREACH WORKSPACE</span>
      <h2 id="workspace-welcome-title">Welcome, {workspace.clientName}.</h2>
      <p>Your outreach starts with a shared plan. Here’s how you and your Covora team can get started.</p>
      <div className="welcome-actions">
        <Link className="welcome-primary" href={`${base}/settings${query}`}>View accounts <ArrowRight size={16} aria-hidden="true" /></Link>
        {canManageTeam(workspace.role) && <Link className="welcome-secondary" href={`${base}/settings/team${query}`}>Manage team</Link>}
      </div>
    </div>
    <div className="welcome-next">
      <h3>What comes next</h3>
      <ol className="welcome-steps">
        {steps.map((step, index) => <li key={step.title}>
          <span className="welcome-step-number" aria-hidden="true">0{index + 1}</span>
          <span className="welcome-step-icon" aria-hidden="true"><step.icon size={20} /></span>
          <h4>{step.title}</h4>
          <p>{step.description}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}
