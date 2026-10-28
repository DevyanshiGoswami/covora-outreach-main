import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSchema } from "../scripts/export-schema.mjs";
import { checkBoundary } from "../scripts/check-boundary.mjs";

const blockedName = String.fromCharCode(
  105,
  110,
  115,
  116,
  97,
  110,
  116,
  108,
  121,
);
const table = (fields) =>
  `{ Row: { ${fields.map((field) => `${field}: string | null`).join("; ")} }; Insert: {}; Update: {}; Relationships: [{ referencedRelation: "private_accounts" }] }`;
function source(extraViewField = "", { quotedKeys = false } = {}) {
  const key = (name) => quotedKeys ? JSON.stringify(name) : name;
  return `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
  export type Database = { ${key("public")}: {
    ${key("Tables")}: {
      profiles: ${table(["id", "role", "client_id", "full_name", "email", "secret_profile"])};
      clients: ${table(["id", "name", "company_name", "timezone", "secret_client"])};
      client_features: ${table(["client_id", "feature", "enabled", "secret_config"])};
      ${blockedName}_accounts: ${table(["password"])};
    };
    ${key("Views")}: { ${[
      "workspaces",
      "setup_requests",
      "campaigns",
      "campaign_steps",
      "campaign_daily",
      "leads",
      "messages",
      "network_campaigns",
      "linkedin_daily",
    ]
      .map(
        (name) =>
          `${key(`client_outreach_${name}`)}: { ${key("Row")}: { ${key("id")}: string | null; ${key("client_id")}: string | null; ${extraViewField} }; Relationships: [{ referencedRelation: "${blockedName}_accounts" }] }`,
      )
      .join("; ")} };
    ${key("Functions")}: { ${key("mark_outreach_messages_read")}: { Args: { ids: string[] }; Returns: number }; other_rpc: { Args: {}; Returns: string } };
    Enums: { user_role: 'admin' | 'client' }; CompositeTypes: {};
  } }`;
}

function assertSafeProjection(output) {
  assert.doesNotMatch(output, new RegExp(blockedName, "i"));
  assert.doesNotMatch(output, /private_accounts|secret_|other_rpc/);
  assert.match(output, /client_outreach_linkedin_daily/);
  assert.match(output, /client_outreach_network_campaigns/);
  assert.doesNotMatch(output, /profiles|client_features|user_role|Insert:/);
  assert.match(output, /client_outreach_workspaces/);
  assert.match(output, /client_outreach_setup_requests/);
  assert.match(output, /Relationships: \[\s*\]/);
  assert.match(output, /mark_outreach_messages_read/);
}

test("schema export projects guarded access and neutral views without relationships or write privileges", () => {
  assertSafeProjection(projectSchema(source()));
});

test("quoted generated property names retain discovered LinkedIn views without widening the projection", () => {
  const quoted = source("", { quotedKeys: true });
  const singleQuoted = quoted.replace(/"([A-Za-z_]\w*)"(?=\s*:)/g, "'$1'");
  const escaped = quoted.replace('"client_outreach_linkedin_daily"', '"client_outreach_linkedin\\u005fdaily"');
  for (const input of [quoted, singleQuoted, escaped]) {
    const output = projectSchema(input);
    assertSafeProjection(output);
    assert.equal((output.match(/client_outreach_\w+:\s*\{/g) || []).length, 9);
  }
  assert.throws(
    () => projectSchema(source('"provider_email_id": string;', { quotedKeys: true })),
    /forbidden identifier/,
  );
  assert.throws(
    () => projectSchema(quoted.replace('"client_outreach_workspaces"', '"removed_workspaces"')),
    /Required schema field/,
  );
});

test("schema export fails closed when required fields vanish or forbidden fields enter a view", () => {
  assert.throws(
    () =>
      projectSchema(source().replace("client_outreach_workspaces", "removed_workspaces")),
    /Required schema field/,
  );
  assert.throws(
    () => projectSchema(source("provider_email_id: string;")),
    /forbidden identifier/,
  );
  assert.throws(
    () => projectSchema(source(`${blockedName}_value: string;`)),
    /forbidden identifier/,
  );
});

test("boundary scan catches case-insensitive substrings, including hidden source files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "outreach-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "node_modules"));
  await writeFile(join(root, "node_modules", "dependency.txt"), blockedName);
  await writeFile(join(root, "safe.ts"), 'export const name = "Workspace"');
  assert.deepEqual(await checkBoundary(root), []);
  await writeFile(
    join(root, ".hidden"),
    `My${blockedName.toUpperCase()}Campaign`,
  );
  assert.deepEqual(await checkBoundary(root), [".hidden"]);
});
