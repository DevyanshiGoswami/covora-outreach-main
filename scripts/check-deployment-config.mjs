import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
      ? url.origin : null;
  } catch { return null; }
}

/** Offline target checks; expected values must come from the dedicated project's trusted configuration. */
export function checkDeploymentConfig(env, { projectRef, apiOrigin, publicKeySha256 } = {}) {
  const failures = [];
  const expectedApi = httpsOrigin(apiOrigin);
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) failures.push("Expected dedicated project reference is invalid.");
  if (!expectedApi || new URL(expectedApi).hostname === "app.covora.app") failures.push("Expected API origin must be the dedicated HTTPS backend.");
  if (httpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL) !== `https://${projectRef}.supabase.co`) failures.push("NEXT_PUBLIC_SUPABASE_URL does not match the expected project.");
  if (!expectedApi || httpsOrigin(env.OUTBOUND_API_ORIGIN) !== expectedApi) failures.push("OUTBOUND_API_ORIGIN does not match the expected HTTPS backend.");

  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let publicKeyMatches = false;
  if (typeof key === "string" && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    // Publishable keys do not expose their project. Compare against a digest
    // independently obtained from the expected project's public key.
    publicKeyMatches = /^[a-f0-9]{64}$/.test(publicKeySha256 ?? "") && createHash("sha256").update(key).digest("hex") === publicKeySha256;
  } else if (typeof key === "string" && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      publicKeyMatches = claims.role === "anon" && claims.ref === projectRef;
    } catch { /* Never echo malformed key material. */ }
  }
  if (!publicKeyMatches) failures.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must be a public key verified for the expected project.");
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const options = {};
  const names = { "--project-ref": "projectRef", "--api-origin": "apiOrigin", "--public-key-sha256": "publicKeySha256" };
  let invalid = false;
  for (let index = 0; index < args.length; index += 2) {
    const name = names[args[index]];
    if (!name || !args[index + 1] || options[name]) { invalid = true; break; }
    options[name] = args[index + 1];
  }
  const failures = invalid ? ["Use --project-ref and --api-origin; --public-key-sha256 is required for publishable keys."] : checkDeploymentConfig(process.env, options);
  if (failures.length) {
    console.error(`Deployment configuration failed:\n${failures.join("\n")}`);
    process.exitCode = 1;
  } else console.log("Dedicated deployment configuration passed. No network requests were made.");
}
