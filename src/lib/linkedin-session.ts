export class LinkedInSessionInputError extends Error {}
export type LinkedInSessionCookie = { name: string; value: string; domain: string; path: string };
const invalid = () => new LinkedInSessionInputError("Paste a fresh JSON cookie export from linkedin.com containing li_at and JSESSIONID.");

/** Discard tracking cookies and extension metadata before sending the session. */
export function parseLinkedInSession(value: unknown): LinkedInSessionCookie[] {
  if (typeof value !== "string" || value.length > 65536) throw invalid();
  let rows: unknown;
  try { rows = JSON.parse(value); } catch { throw invalid(); }
  if (!Array.isArray(rows) || rows.length > 100) throw invalid();
  const result: LinkedInSessionCookie[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || !["li_at", "JSESSIONID"].includes(row.name)) continue;
    if (![".linkedin.com", "linkedin.com", "www.linkedin.com", ".www.linkedin.com"].includes(row.domain) || row.path !== "/"
      || typeof row.value !== "string" || !row.value.length || row.value.length > 2048 || !/^[\x21-\x7e]+$/.test(row.value)
      || result.some(cookie => cookie.name === row.name)) throw invalid();
    if (typeof row.expirationDate === "number" && row.expirationDate > 0 && row.expirationDate * 1000 <= Date.now()) throw invalid();
    result.push({ name: row.name, value: row.value, domain: row.domain, path: "/" });
  }
  if (result.length !== 2) throw invalid();
  return result;
}

export function sessionConnectionFields(form: FormData) {
  const cookies = parseLinkedInSession(form.get("cookies"));
  let profile: URL;
  try { profile = new URL(String(form.get("profileUrl") ?? "").trim()); } catch { throw new LinkedInSessionInputError("Enter your LinkedIn profile URL, for example https://www.linkedin.com/in/your-name."); }
  if (profile.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(profile.hostname) || profile.port || profile.username || profile.password
    || !/^\/in\/[a-zA-Z0-9_%.-]+\/?$/.test(profile.pathname) || profile.pathname.length > 250) throw new LinkedInSessionInputError("Enter a LinkedIn profile URL starting with https://www.linkedin.com/in/.");
  const userAgent = form.get("userAgent");
  if (typeof userAgent !== "string" || !userAgent.length || userAgent.length > 512 || !/^[\x20-\x7e]+$/.test(userAgent)) throw new LinkedInSessionInputError("Reload this page and use the same browser you exported the session from.");
  const fields = { method: "cookies" as const, cookies, profileUrl: `https://www.linkedin.com${profile.pathname.replace(/\/$/, "").toLowerCase()}`, userAgent };
  if (new TextEncoder().encode(JSON.stringify(fields)).length > 6500) throw invalid();
  return fields;
}
