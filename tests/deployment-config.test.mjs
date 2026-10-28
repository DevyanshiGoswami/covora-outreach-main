import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkDeploymentConfig } from "../scripts/check-deployment-config.mjs";

const projectRef = "a".repeat(20);
const apiOrigin = "https://api.outreach.example.com";
// Deliberately unsigned, synthetic strings; no usable credentials.
const key = (claims) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.synthetic`;
const env = { NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: key({ role: "anon", ref: projectRef }), OUTBOUND_API_ORIGIN: apiOrigin };
const expected = { projectRef, apiOrigin };

test("deployment checks require one dedicated project and exact HTTPS backend", () => {
  assert.deepEqual(checkDeploymentConfig(env, expected), []);
  for (const url of ["", "https://other-project.supabase.co", "http://localhost:54321", `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, `https://user:pass@${projectRef}.supabase.co`]) {
    assert.ok(checkDeploymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }, expected).some((failure) => failure.includes("NEXT_PUBLIC_SUPABASE_URL")));
  }
  for (const origin of ["", "http://api.outreach.example.com", "https://app.covora.app", `${apiOrigin}/api`, `${apiOrigin}?redirect=x`, "https://other.example.com"]) {
    assert.ok(checkDeploymentConfig({ ...env, OUTBOUND_API_ORIGIN: origin }, expected).some((failure) => failure.includes("OUTBOUND_API_ORIGIN")));
  }
  assert.ok(checkDeploymentConfig({ ...env, OUTBOUND_API_ORIGIN: "https://app.covora.app" }, { ...expected, apiOrigin: "https://app.covora.app" }).length);
  assert.ok(checkDeploymentConfig(env).length);
});

test("only the expected project's public key passes, including pinned publishable keys", () => {
  for (const value of [undefined, "", "malformed", "sb_secret_synthetic", key({ role: "service_role", ref: projectRef }), key({ role: "anon", ref: "b".repeat(20) }), key({ role: "anon" }), "e30.invalid.synthetic"]) {
    assert.ok(checkDeploymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: value }, expected).some((failure) => failure.includes("ANON_KEY")));
  }
  const publishable = "sb_publishable_synthetic";
  const publicKeySha256 = createHash("sha256").update(publishable).digest("hex");
  assert.deepEqual(checkDeploymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable }, { ...expected, publicKeySha256 }), []);
  assert.ok(checkDeploymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable }, expected).length);
  assert.ok(checkDeploymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable }, { ...expected, publicKeySha256: "0".repeat(64) }).length);
});

test("configuration command fails closed without echoing credential material", () => {
  const sensitive = "sentinel-value-that-must-not-be-printed";
  const result = spawnSync(process.execPath, ["scripts/check-deployment-config.mjs", "--project-ref", projectRef, "--api-origin", apiOrigin], { encoding: "utf8", env: { ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: sensitive } });
  assert.equal(result.status, 1);
  assert.equal(`${result.stdout}${result.stderr}`.includes(sensitive), false);
  const success = spawnSync(process.execPath, ["scripts/check-deployment-config.mjs", "--project-ref", projectRef, "--api-origin", apiOrigin], { encoding: "utf8", env });
  assert.equal(success.status, 0);
});
