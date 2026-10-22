import assert from "node:assert/strict";
import test from "node:test";

import { createObservationScheduler } from "../src/observation-scheduler.mjs";

test("waits, reserves once, and spaces completed observations", () => {
  let now = 0;
  const scheduler = createObservationScheduler({
    now: () => now,
    initialDelayMs: 10,
    intervalMs: 20,
    retryDelayMs: 5,
  });
  scheduler.start("one");
  assert.equal(scheduler.due("one", "v1"), false);
  now = 10;
  assert.equal(scheduler.reserve("one", "v1"), true);
  assert.equal(scheduler.reserve("one", "v1"), false);
  scheduler.complete("one", "v1");
  assert.equal(scheduler.due("one", "v1"), false);
  now = 29;
  assert.equal(scheduler.due("one", "v2"), false);
  now = 30;
  assert.equal(scheduler.due("one", "v2"), true);
});

test("pause and user activity invalidate reservations and reset cadence", () => {
  let now = 100;
  const scheduler = createObservationScheduler({ now: () => now, initialDelayMs: 1, intervalMs: 10, retryDelayMs: 2 });
  scheduler.start("two", { startedAt: 99 });
  assert.equal(scheduler.reserve("two", "v1"), true);
  scheduler.setPaused("two", true);
  assert.equal(scheduler.reservationIsCurrent("two", "v1"), false);
  now = 200;
  scheduler.setPaused("two", false);
  assert.equal(scheduler.due("two", "v2"), false);
  now = 210;
  assert.equal(scheduler.due("two", "v2"), true);
  scheduler.noteUserActivity("two", "v2");
  assert.equal(scheduler.due("two", "v3"), false);
});
