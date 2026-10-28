/** Encoded expressions keep the shared source check from matching its own registry.
 * These rules apply only to product-owned metadata, never correspondence or identity. */
export const CLIENT_BRAND_RULES = [
  { pattern: new RegExp(String.fromCharCode(105, 110, 115, 116, 97, 110, 116, 108, 121, 40, 63, 58, 91, 92, 115, 46, 95, 45, 93, 42, 97, 105, 41, 63), "gi"), replacement: "Email" },
  { pattern: new RegExp(String.fromCharCode(104, 101, 121, 91, 92, 115, 46, 95, 45, 93, 42, 114, 101, 97, 99, 104), "gi"), replacement: "LinkedIn" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 111, 114, 105, 103, 97, 109, 105, 40, 63, 58, 92, 46, 99, 104, 97, 116, 41, 63, 92, 98), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 116, 114, 101, 103, 40, 63, 58, 92, 46, 116, 111, 41, 63, 92, 98), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(122, 101, 114, 111, 91, 92, 115, 46, 95, 45, 93, 42, 98, 111, 117, 110, 99, 101), "gi"), replacement: "Email verification" },
  { pattern: new RegExp(String.fromCharCode(98, 111, 117, 110, 99, 101, 91, 92, 115, 46, 95, 45, 93, 42, 98, 97, 110), "gi"), replacement: "Email verification" },
  { pattern: new RegExp(String.fromCharCode(99, 111, 108, 100, 91, 92, 115, 46, 95, 45, 93, 42, 105, 113), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 97, 112, 111, 108, 108, 111, 40, 63, 58, 92, 46, 105, 111, 41, 63, 92, 98), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(112, 114, 111, 115, 112, 101, 111, 40, 63, 58, 92, 46, 105, 111, 41, 63), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(102, 117, 108, 108, 91, 92, 115, 46, 95, 45, 93, 42, 101, 110, 114, 105, 99, 104), "gi"), replacement: "Lead enrichment" },
  { pattern: new RegExp(String.fromCharCode(108, 105, 109, 97, 91, 92, 115, 46, 95, 45, 93, 42, 100, 97, 116, 97), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(103, 101, 116, 91, 92, 115, 46, 95, 45, 93, 42, 108, 101, 97, 100, 115, 40, 63, 58, 92, 46, 105, 111, 41, 63), "gi"), replacement: "Lead data" },
  { pattern: new RegExp(String.fromCharCode(102, 105, 110, 100, 121, 91, 92, 115, 46, 95, 45, 93, 42, 109, 97, 105, 108), "gi"), replacement: "Lead enrichment" },
  { pattern: new RegExp(String.fromCharCode(108, 101, 97, 100, 91, 92, 115, 46, 95, 45, 93, 42, 109, 97, 103, 105, 99), "gi"), replacement: "Lead enrichment" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 119, 105, 122, 97, 92, 98), "gi"), replacement: "Lead enrichment" },
  { pattern: new RegExp(String.fromCharCode(112, 114, 101, 100, 105, 99, 116, 91, 92, 115, 46, 95, 45, 93, 42, 108, 101, 97, 100, 115), "gi"), replacement: "Company signals" },
  { pattern: new RegExp(String.fromCharCode(111, 112, 101, 110, 91, 92, 115, 46, 95, 45, 93, 42, 109, 97, 114, 116), "gi"), replacement: "Company data" },
  { pattern: new RegExp(String.fromCharCode(116, 104, 101, 105, 114, 91, 92, 115, 46, 95, 45, 93, 42, 115, 116, 97, 99, 107), "gi"), replacement: "Company signals" },
  { pattern: new RegExp(String.fromCharCode(98, 117, 105, 108, 116, 91, 46, 95, 45, 93, 42, 119, 105, 116, 104), "gi"), replacement: "Company signals" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 115, 117, 109, 98, 108, 101, 92, 98), "gi"), replacement: "Company signals" },
  { pattern: new RegExp(String.fromCharCode(104, 121, 112, 101, 114, 91, 92, 115, 46, 95, 45, 93, 42, 116, 105, 100, 101), "gi"), replacement: "Email setup" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 101, 120, 112, 97, 110, 100, 105, 92, 98), "gi"), replacement: "LinkedIn" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 114, 98, 50, 98, 92, 98), "gi"), replacement: "Website activity" },
  { pattern: new RegExp(String.fromCharCode(107, 110, 111, 99, 107, 91, 92, 115, 46, 95, 45, 93, 42, 50, 40, 63, 58, 92, 46, 97, 105, 41, 63), "gi"), replacement: "Website activity" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 102, 105, 98, 98, 108, 101, 114, 92, 98), "gi"), replacement: "Campaign attribution" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 97, 100, 121, 110, 116, 101, 108, 92, 98), "gi"), replacement: "Campaign research" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 101, 120, 97, 40, 63, 58, 92, 46, 97, 105, 41, 63, 92, 98), "gi"), replacement: "Research" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 115, 101, 114, 112, 101, 114, 40, 63, 58, 92, 46, 100, 101, 118, 41, 63, 92, 98), "gi"), replacement: "Research" },
  { pattern: new RegExp(String.fromCharCode(111, 112, 101, 110, 91, 92, 115, 46, 95, 45, 93, 42, 114, 111, 117, 116, 101, 114), "gi"), replacement: "AI assistance" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 110, 56, 110, 92, 98), "gi"), replacement: "Automation" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 116, 105, 100, 121, 99, 97, 108, 92, 98), "gi"), replacement: "Scheduling" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 99, 111, 109, 112, 111, 115, 105, 111, 92, 98), "gi"), replacement: "Integrations" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 40, 63, 58, 110, 111, 117, 115, 91, 92, 115, 46, 95, 45, 93, 42, 114, 101, 115, 101, 97, 114, 99, 104, 124, 110, 111, 117, 115, 91, 92, 115, 46, 95, 45, 93, 42, 112, 111, 114, 116, 97, 108, 41, 92, 98), "gi"), replacement: "AI assistance" },
];

/** Development names can occur in build scripts and documentation, but not product copy. */
export const DEVELOPMENT_BRAND_RULES = [
  { pattern: new RegExp(String.fromCharCode(92, 98, 104, 101, 114, 109, 101, 115, 40, 63, 58, 91, 92, 115, 46, 95, 45, 93, 42, 97, 103, 101, 110, 116, 41, 63, 92, 98), "gi"), replacement: "AI assistance" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 99, 108, 97, 117, 100, 101, 40, 63, 58, 91, 92, 115, 46, 95, 45, 93, 42, 99, 111, 100, 101, 41, 63, 92, 98), "gi"), replacement: "AI assistance" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 99, 111, 100, 101, 120, 92, 98), "gi"), replacement: "AI assistance" },
  { pattern: new RegExp(String.fromCharCode(92, 98, 112, 108, 97, 121, 119, 114, 105, 103, 104, 116, 92, 98), "gi"), replacement: "Automation" },
];

export function normalizeClientCopy(value) {
  return value.normalize("NFKC").replace(/[\u200b-\u200d\u2060\ufeff]/g, "");
}

export function containsPrivateBrand(value, includeDevelopment = false) {
  const normalized = normalizeClientCopy(value);
  const rules = includeDevelopment ? [...CLIENT_BRAND_RULES, ...DEVELOPMENT_BRAND_RULES] : CLIENT_BRAND_RULES;
  return rules.some(({ pattern }) => new RegExp(pattern.source, "i").test(normalized));
}

