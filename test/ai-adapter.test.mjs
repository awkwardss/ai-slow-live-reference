import assert from "node:assert/strict";
import test from "node:test";

import { buildCompanionFrameEvent, consumeReservedObservation } from "../src/ai-adapter.mjs";
import { createLiveSessionStore } from "../src/live-session-store.mjs";
import { createObservationScheduler } from "../src/observation-scheduler.mjs";

const frame = {
  bytes: Buffer.from([0xff, 0xd8, 1, 0xff, 0xd9]),
  contentType: "image/jpeg",
  updatedAt: 1_000,
  version: "version-one",
  location: null,
};

test("distinguishes application observations from real user turns", () => {
  const userTurn = buildCompanionFrameEvent({ frame, mode: "user-turn", now: 1_000 });
  const observation = buildCompanionFrameEvent({ frame, mode: "proactive-observation", now: 1_000 });
  assert.equal(userTurn.kind, "user-turn");
  assert.match(userTurn.semantics, /real user turn/u);
  assert.equal(observation.kind, "proactive-observation");
  assert.match(observation.semantics, /Do not fabricate/u);
});

test("does not consume a replaced frame reserved by delayed work", async () => {
  let now = 10;
  const store = createLiveSessionStore({ now: () => now });
  const scheduler = createObservationScheduler({ now: () => now, initialDelayMs: 1 });
  store.start("race");
  store.updateFrame("race", frame.bytes);
  scheduler.start("race", { startedAt: 0 });

  let delivered = 0;
  const originalReserve = scheduler.reserve.bind(scheduler);
  scheduler.reserve = (sessionId, version) => {
    const reserved = originalReserve(sessionId, version);
    if (reserved) store.updateFrame("race", Buffer.from([0xff, 0xd8, 2, 0xff, 0xd9]));
    return reserved;
  };

  const result = await consumeReservedObservation({
    sessionId: "race",
    store,
    scheduler,
    deliver: async () => { delivered += 1; },
  });
  assert.deepEqual(result, { delivered: false });
  assert.equal(delivered, 0);
  store.stopAll();
});
