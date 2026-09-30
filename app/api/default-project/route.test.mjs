import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createJiti } from "jiti";
import { NextRequest } from "next/server.js";

const root = await mkdtemp(join(tmpdir(), "pi-web-default-project-route-"));
const agentDir = join(root, "agent");
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = agentDir;
await mkdir(agentDir, { recursive: true });

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { GET, POST, PUT } = await jiti.import("./route.ts");

after(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(root, { recursive: true, force: true });
});

function request(method, body) {
  return new NextRequest("http://localhost/api/default-project", {
    method,
    headers: {
      Host: "localhost",
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("GET reports the built-in project directory until a custom path is saved", async () => {
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.path, "");
  assert.equal(body.placeholder, "~/pi-cwd");
  assert.equal(body.resolved, join(homedir(), "pi-cwd"));
});

test("PUT stores a project directory and POST creates a named folder there", async () => {
  const base = join(root, "projects");
  let response = await PUT(request("PUT", { path: base }));
  let body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { path: base, resolved: base, placeholder: "~/pi-cwd" });

  response = await POST(request("POST", { name: "project123" }));
  body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { cwd: join(base, "project123") });
  assert.equal((await stat(join(base, "project123"))).isDirectory(), true);

  // 同名目录直接复用，不报错。
  response = await POST(request("POST", { name: "project123" }));
  body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { cwd: join(base, "project123") });

  response = await PUT(request("PUT", { path: "" }));
  body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.path, "");
  assert.equal(body.resolved, join(homedir(), "pi-cwd"));
});


test("POST rejects a missing or unusable project name", async () => {
  let response = await POST(request("POST", {}));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /required/);

  response = await POST(request("POST", { name: "../escape" }));
  assert.equal(response.status, 400);
});

test("PUT rejects a relative path", async () => {
  const response = await PUT(request("PUT", { path: "relative/dir" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /absolute path/);
});

test("rejects untrusted mutating requests", async () => {
  const response = await PUT(new NextRequest("http://localhost/api/default-project", {
    method: "PUT",
    headers: {
      Host: "localhost",
      Origin: "https://evil.example",
      "Sec-Fetch-Site": "cross-site",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: join(root, "nope") }),
  }));
  assert.equal(response.status, 403);
});
