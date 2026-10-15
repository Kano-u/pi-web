import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssSource = await readFile(new URL("../app/settings.css", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
const enSource = await readFile(new URL("../lib/i18n/messages/en.ts", import.meta.url), "utf8");

test("the trust dialog Settings › MCP opens stacks above Settings", () => {
  const zIndex = (selector) => Number(cssSource.match(new RegExp(`\\${selector} \\{[^}]*z-index: (\\d+);`))?.[1]);
  assert.ok(zIndex(".project-trust-backdrop") > zIndex(".settings-dialog-backdrop"));
});

test("the login page returns only to a destination safeLoginDestination() accepts", () => {
  assert.match(loginSource, /safeLoginDestination\(destination, window\.location\.origin\)/);
});

test("lets users customize the default project directory from General settings", () => {
  assert.match(panelSource, /function DefaultProjectSettings\(/);
  assert.match(panelSource, /<DefaultProjectSettings \/>/);
  assert.match(panelSource, /fetch\("\/api\/default-project"\)/);
  assert.match(panelSource, /method: "PUT"/);
  assert.match(panelSource, /<DirectoryPicker/);
  assert.match(enSource, /"settings\.defaultProjectPath": "Default project directory"/);
  assert.match(cssSource, /\.settings-default-project-input \{/);
});
