import assert from "node:assert/strict";
import test from "node:test";
import { parseSelection } from "../src/lib/model";

test("untrusted URL options cannot select arbitrary result views", () => {
  assert.deepEqual(
    parseSelection({
      view: "settings",
      tab: "write",
      range: "tomorrow",
      client: ["a", "b"],
    }),
    {
      view: "overview",
      tab: "analytics",
      range: "30d",
      client: "",
      campaign: "",
    },
  );
});
