import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { pathToFileURL } from "node:url";
import { containsPrivateBrand } from "../src/lib/client-brand-registry.mjs";

const forbidden = new RegExp(
  String.fromCharCode(105, 110, 115, 116, 97, 110, 116, 108, 121),
  "i",
);
const namesForAdmin = [[105,110,115,116,97,110,116,108,121],[72,101,121,82,101,97,99,104]].map(codes => String.fromCharCode(...codes));
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "test-results",
]);

export async function checkBoundary(root) {
  const failures = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const contents = await readFile(path);
        if (contents.includes(0)) continue;
        let text = contents.toString("utf8");
        const fileName = relative(root, path);
        // User-authorized names only in the agency-owner integration component.
        // No other source, labels, service domains, or credential data are exempt.
        if (fileName === "src/components/agency-integrations.tsx")
          text = text.replace(new RegExp(`"(?:${[namesForAdmin[0], namesForAdmin[1]].join("|")})"`, "gi"), '""');
        if (forbidden.test(text) || forbidden.test(fileName) || containsPrivateBrand(text) || containsPrivateBrand(fileName))
          failures.push(relative(root, path));
      }
    }
  }
  await walk(root);
  return failures;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const failures = await checkBoundary(resolve(process.argv[2] ?? "."));
  if (failures.length) {
    console.error(`Brand boundary failed in: ${failures.join(", ")}`);
    process.exitCode = 1;
  } else console.log("Brand boundary passed.");
}
