import assert from "node:assert/strict";
import test from "node:test";

import { createReferenceServer } from "../src/server.mjs";

const jpeg = Buffer.from([0xff, 0xd8, 8, 0xff, 0xd9]);

test("HTTP lifecycle starts, replaces, clears location, and stops", async (context) => {
  const server = createReferenceServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const startedResponse = await fetch(`${base}/api/live-sessions`, { method: "POST" });
  assert.equal(startedResponse.status, 201);
  const started = await startedResponse.json();
  assert.equal(started.active, true);

  const updatedResponse = await fetch(`${base}/api/live-sessions/${started.sessionId}/frame`, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
      "X-Slow-Live-Location-Shared": "1",
      "X-Slow-Live-Latitude": "12.5",
      "X-Slow-Live-Longitude": "30.25",
      "X-Slow-Live-Accuracy": "7",
      "X-Slow-Live-Captured-At": String(Date.now()),
    },
    body: jpeg,
  });
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.equal(updated.frameCount, 1);
  assert.equal(updated.locationShared, true);

  const frameResponse = await fetch(`${base}/api/live-sessions/${started.sessionId}/frame`);
  assert.equal(frameResponse.status, 200);
  assert.deepEqual(Buffer.from(await frameResponse.arrayBuffer()), jpeg);

  const clearedResponse = await fetch(`${base}/api/live-sessions/${started.sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clearLocation: true }),
  });
  assert.equal((await clearedResponse.json()).locationShared, false);

  const stoppedResponse = await fetch(`${base}/api/live-sessions/${started.sessionId}`, { method: "DELETE" });
  assert.deepEqual(await stoppedResponse.json(), { active: false, hasFrame: false });
  const missingFrame = await fetch(`${base}/api/live-sessions/${started.sessionId}/frame`);
  assert.equal(missingFrame.status, 404);
});
