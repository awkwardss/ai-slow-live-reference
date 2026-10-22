import assert from "node:assert/strict";
import test from "node:test";

import { freshLocation, locationSummary, normalizeLocation } from "../src/location.mjs";

test("normalizes bounded coordinates and optional movement", () => {
  const value = normalizeLocation({
    latitude: "40.25",
    longitude: 116.5,
    accuracy: 8.2,
    capturedAt: 1_000,
    speed: 10,
    heading: 359.6,
  });
  assert.deepEqual(value, {
    latitude: 40.25,
    longitude: 116.5,
    accuracy: 8.2,
    capturedAt: 1_000,
    speed: 10,
    heading: 359.6,
  });
});

test("drops invalid, stale, and implausibly future locations", () => {
  const base = { latitude: 1, longitude: 2, accuracy: 3, capturedAt: 10_000 };
  assert.equal(normalizeLocation({ ...base, latitude: 91 }), null);
  assert.equal(normalizeLocation({ longitude: 2, accuracy: 3, capturedAt: 10_000 }), null);
  assert.equal(normalizeLocation({ ...base, speed: -1 }), null);
  assert.equal(freshLocation(base, { now: 200_001, maxAgeMs: 120_000 }), null);
  assert.equal(freshLocation(base, { now: 1, futureToleranceMs: 100 }), null);
});

test("creates a bounded summary without reverse geocoding", () => {
  const summary = locationSummary({
    latitude: 10.1234567,
    longitude: 20.7654321,
    accuracy: 0.2,
    capturedAt: 50_000,
    speed: 2,
    heading: null,
  }, { now: 50_010 });
  assert.deepEqual(summary, {
    latitude: 10.123457,
    longitude: 20.765432,
    accuracyMeters: 1,
    capturedAt: new Date(50_000).toISOString(),
    speedKilometersPerHour: 7.2,
    headingDegrees: null,
  });
});
