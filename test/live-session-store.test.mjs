import assert from "node:assert/strict";
import test from "node:test";

import { createLiveSessionStore } from "../src/live-session-store.mjs";

const jpeg = (marker) => Buffer.from([0xff, 0xd8, marker, 0xff, 0xd9]);

test("retains only the newest frame and copies returned bytes", () => {
  let now = 1_000;
  const store = createLiveSessionStore({ now: () => now });
  store.start("session_one");
  const first = store.updateFrame("session_one", jpeg(1));
  now += 1;
  const second = store.updateFrame("session_one", jpeg(2));

  assert.equal(second.frameCount, 2);
  assert.notEqual(first.version, second.version);
  const latest = store.latestFrame("session_one");
  assert.deepEqual(latest.bytes, jpeg(2));
  latest.bytes[2] = 99;
  assert.deepEqual(store.latestFrame("session_one").bytes, jpeg(2));
  store.stopAll();
});

test("location is explicit, replaceable, and cleared independently", () => {
  const store = createLiveSessionStore({ now: () => 2_000 });
  store.start("session_two");
  store.updateFrame("session_two", jpeg(3), {
    location: { latitude: 12.25, longitude: 34.5, accuracy: 6, capturedAt: 1_999, speed: null, heading: null },
  });
  assert.equal(store.status("session_two").locationShared, true);

  store.clearLocation("session_two");
  assert.equal(store.status("session_two").locationShared, false);
  assert.equal(store.latestFrame("session_two").location, null);

  store.updateFrame("session_two", jpeg(4), { location: null });
  assert.equal(store.status("session_two").locationShared, false);
  store.stopAll();
});

test("stop and stale expiry invalidate a previously returned version", () => {
  let now = 5_000;
  const store = createLiveSessionStore({ now: () => now, ttlMs: 50 });
  store.start("session_three");
  const state = store.updateFrame("session_three", jpeg(5));
  assert.equal(store.isCurrent("session_three", state.version), true);

  store.stop("session_three");
  assert.equal(store.isCurrent("session_three", state.version), false);
  assert.equal(store.latestFrame("session_three"), null);

  store.start("session_four");
  const expiring = store.updateFrame("session_four", jpeg(6));
  now += 51;
  assert.equal(store.isCurrent("session_four", expiring.version), false);
  assert.deepEqual(store.status("session_four"), { active: false, hasFrame: false });
  store.stopAll();
});

test("rejects invalid sessions, frames, and coordinates", () => {
  const store = createLiveSessionStore({ maximumFrameBytes: 8 });
  assert.throws(() => store.start("bad id"), /Invalid live session id/u);
  store.start("valid");
  assert.throws(() => store.updateFrame("valid", Buffer.from("not jpeg")), /JPEG/u);
  assert.throws(
    () => store.updateFrame("valid", jpeg(7), {
      location: { latitude: 120, longitude: 0, accuracy: 1, capturedAt: Date.now() },
    }),
    /Invalid location/u,
  );
  store.stopAll();
});
