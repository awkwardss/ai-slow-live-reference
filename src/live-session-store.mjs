import { createHash } from "node:crypto";

import { normalizeLocation } from "./location.mjs";

export const DEFAULT_FRAME_TTL_MS = 30_000;
export const DEFAULT_MAX_FRAME_BYTES = 2 * 1024 * 1024;

function requireSessionId(value) {
  const sessionId = String(value ?? "").trim();
  if (!sessionId || sessionId.length > 128 || !/^[A-Za-z0-9_-]+$/u.test(sessionId)) {
    throw new TypeError("Invalid live session id.");
  }
  return sessionId;
}

function validatedJpeg(value, maximumBytes) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value ?? []);
  if (bytes.length < 4 || bytes.length > maximumBytes) {
    throw new TypeError(`JPEG frame must be between 4 and ${maximumBytes} bytes.`);
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new TypeError("Frame must begin with the JPEG start marker.");
  }
  const endMarker = bytes.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (endMarker < 2 || bytes.length - endMarker - 2 > 64 * 1024) {
    throw new TypeError("Frame does not contain a valid JPEG end marker.");
  }
  return bytes;
}

export function createLiveSessionStore({
  now = () => Date.now(),
  ttlMs = DEFAULT_FRAME_TTL_MS,
  maximumFrameBytes = DEFAULT_MAX_FRAME_BYTES,
} = {}) {
  const sessions = new Map();

  function remove(key, expectedState = null) {
    const state = sessions.get(key);
    if (!state || (expectedState && state !== expectedState)) return false;
    if (state.timer) clearTimeout(state.timer);
    sessions.delete(key);
    return true;
  }

  function armExpiry(key, state) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => remove(key, state), ttlMs);
    state.timer.unref?.();
  }

  function getFresh(key) {
    const state = sessions.get(key);
    if (!state) return null;
    if (now() - state.updatedAt > ttlMs) {
      remove(key, state);
      return null;
    }
    return state;
  }

  function statusFor(key) {
    const state = getFresh(key);
    if (!state) return { active: false, hasFrame: false };
    return {
      active: true,
      hasFrame: Boolean(state.frame),
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      frameCount: state.frameCount,
      version: state.version,
      locationShared: Boolean(state.location),
      locationUpdatedAt: state.location?.capturedAt ?? null,
    };
  }

  return {
    start(sessionId) {
      const key = requireSessionId(sessionId);
      remove(key);
      const timestamp = now();
      const state = {
        startedAt: timestamp,
        updatedAt: timestamp,
        frameCount: 0,
        version: null,
        frame: null,
        location: null,
        timer: null,
      };
      sessions.set(key, state);
      armExpiry(key, state);
      return statusFor(key);
    },

    updateFrame(sessionId, value, { location } = {}) {
      const key = requireSessionId(sessionId);
      const state = getFresh(key);
      if (!state) throw new TypeError("Live session is not active.");
      const frame = validatedJpeg(value, maximumFrameBytes);

      let nextLocation = state.location;
      if (location !== undefined) {
        if (location === null) {
          nextLocation = null;
        } else {
          nextLocation = normalizeLocation(location);
          if (!nextLocation) throw new TypeError("Invalid location payload.");
        }
      }

      state.frame = Buffer.from(frame);
      state.location = nextLocation;
      state.frameCount += 1;
      state.updatedAt = now();
      state.version = createHash("sha256").update(frame).digest("hex").slice(0, 20);
      armExpiry(key, state);
      return statusFor(key);
    },

    clearLocation(sessionId) {
      const key = requireSessionId(sessionId);
      const state = getFresh(key);
      if (state) state.location = null;
      return statusFor(key);
    },

    stop(sessionId) {
      remove(requireSessionId(sessionId));
      return { active: false, hasFrame: false };
    },

    status(sessionId) {
      return statusFor(requireSessionId(sessionId));
    },

    latestFrame(sessionId) {
      const key = requireSessionId(sessionId);
      const state = getFresh(key);
      if (!state?.frame) return null;
      return {
        bytes: Buffer.from(state.frame),
        contentType: "image/jpeg",
        updatedAt: state.updatedAt,
        version: state.version,
        location: state.location ? { ...state.location } : null,
      };
    },

    isCurrent(sessionId, version) {
      const state = statusFor(requireSessionId(sessionId));
      return Boolean(state.active && state.hasFrame && state.version === String(version ?? ""));
    },

    stopAll() {
      for (const key of [...sessions.keys()]) remove(key);
    },
  };
}
