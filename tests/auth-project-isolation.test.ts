import test from "node:test";
import assert from "node:assert/strict";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const previousUrl = "https://previous-project.supabase.co";
const currentUrl = "https://current-project.supabase.co";
const user = { id: "10000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "person@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
function syntheticSession(origin: string) {
  const payload = { sub: user.id, iss: `${origin}/auth/v1`, exp: 4102444800 };
  const access_token = `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.synthetic`;
  return { access_token, refresh_token: "synthetic-refresh", token_type: "bearer", expires_at: payload.exp, expires_in: 3600, user };
}
function cookieValue(origin: string) {
  return `base64-${Buffer.from(JSON.stringify(syntheticSession(origin))).toString("base64url")}`;
}

test("default SSR cookies ignore previous-project sessions, including chunked cookies", async () => {
  const previous = cookieValue(previousUrl);
  for (const cookies of [
    [{ name: "sb-previous-project-auth-token", value: previous }],
    [{ name: "sb-previous-project-auth-token.0", value: previous.slice(0, 100) }, { name: "sb-previous-project-auth-token.1", value: previous.slice(100) }],
  ]) {
    const client = createServerClient(currentUrl, "sb_publishable_synthetic", {
      cookies: { getAll: () => cookies, setAll: () => assert.fail("Old cookies must not be modified") },
      global: { fetch: async () => assert.fail("An old-project session must not reach the new auth service") },
    });
    const { data, error } = await client.auth.getUser();
    assert.equal(data.user, null);
    assert.equal(error?.name, "AuthSessionMissingError");
  }
});

test("current-project auth and local sign-out leave previous-project cookies untouched", async () => {
  const cookies = new Map([
    ["sb-previous-project-auth-token", cookieValue(previousUrl)],
    ["sb-current-project-auth-token", cookieValue(currentUrl)],
  ]);
  const previous = cookies.get("sb-previous-project-auth-token");
  const written: { name: string; value: string; options: CookieOptions }[] = [];
  const requests: string[] = [];
  const client = createServerClient(currentUrl, "sb_publishable_synthetic", {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (updates) => { for (const update of updates) { written.push(update); cookies.set(update.name, update.value); } },
    },
    global: { fetch: async (input, init) => {
      const url = String(input);
      requests.push(url);
      assert.equal(new URL(url).origin, currentUrl);
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${syntheticSession(currentUrl).access_token}`);
      if (url === `${currentUrl}/auth/v1/user`) return Response.json(user);
      assert.equal(url, `${currentUrl}/auth/v1/logout?scope=local`);
      assert.equal(init?.method, "POST");
      return new Response(null, { status: 204 });
    } },
  });
  assert.equal((await client.auth.getUser()).data.user?.id, user.id);
  assert.equal((await client.auth.signOut({ scope: "local" })).error, null);
  assert.ok(requests.includes(`${currentUrl}/auth/v1/user`));
  assert.ok(written.some((cookie) => cookie.name === "sb-current-project-auth-token" && cookie.options.maxAge === 0));
  assert.ok(written.every((cookie) => cookie.name.startsWith("sb-current-project-") && cookie.options.domain === undefined));
  assert.equal(cookies.get("sb-previous-project-auth-token"), previous);
});
