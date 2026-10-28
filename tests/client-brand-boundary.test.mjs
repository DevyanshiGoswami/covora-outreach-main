import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBoundary } from "../scripts/check-boundary.mjs";

const names = [
  [105, 110, 115, 116, 97, 110, 116, 108, 121],
  [104, 101, 121, 114, 101, 97, 99, 104],
  [111, 114, 105, 103, 97, 109, 105],
  [116, 114, 101, 103],
  [122, 101, 114, 111, 98, 111, 117, 110, 99, 101],
  [98, 111, 117, 110, 99, 101, 98, 97, 110],
  [111, 112, 101, 110, 114, 111, 117, 116, 101, 114],
].map((codes) => String.fromCharCode(...codes));

test("brand boundary rejects supplier labels and domains in UI, notes and filenames", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "client-brand-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src"));
  for (const [index, name] of names.entries()) {
    const path = `src/label-${index}.tsx`;
    await writeFile(join(root, path), `<p>Connected through ${name.toUpperCase()}</p>`);
    assert.ok((await checkBoundary(root)).includes(path));
    await writeFile(join(root, path), `const help = "https://app.${name}.com/settings";`);
    assert.ok((await checkBoundary(root)).includes(path));
    await rm(join(root, path));
  }
  const path = `src/${names[1]}-connection.ts`;
  await writeFile(join(root, path), "export const label = 'Connected';");
  assert.deepEqual(await checkBoundary(root), [path]);
});

test("brand boundary allows client channels, normal language and excluded dependencies", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "client-brand-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "node_modules"));
  await writeFile(join(root, "node_modules", "dependency.txt"), names.join(" "));
  await writeFile(join(root, "copy.ts"), "Covora email and LinkedIn. Google Workspace and Microsoft. Example campaigns, exact matches, regularly updated.");
  assert.deepEqual(await checkBoundary(root), []);
});

test("only the owner connector component may use the two approved display names", async t => {
  const root=await mkdtemp(join(tmpdir(),"owner-connector-boundary-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,"src/components"),{recursive:true});
  const path="src/components/agency-integrations.tsx";
  await writeFile(join(root,path),`const names = { email: "${names[0]}", linkedin: "${names[1]}" };`);
  assert.deepEqual(await checkBoundary(root),[]);
  await writeFile(join(root,path),`const url = "https://app.${names[0]}.ai";`);
  assert.deepEqual(await checkBoundary(root),[path]);
  await writeFile(join(root,path),`const name = "${names[2]}";`);
  assert.deepEqual(await checkBoundary(root),[path]);
});
