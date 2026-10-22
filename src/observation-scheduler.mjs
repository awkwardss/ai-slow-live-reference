const DEFAULT_INITIAL_DELAY_MS = 12_000;
const DEFAULT_INTERVAL_MS = 45_000;
const DEFAULT_RETRY_DELAY_MS = 10_000;

function duration(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function createObservationScheduler({
  now = () => Date.now(),
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  const records = new Map();
  const initialDelay = duration(initialDelayMs, DEFAULT_INITIAL_DELAY_MS);
  const interval = duration(intervalMs, DEFAULT_INTERVAL_MS);
  const retryDelay = duration(retryDelayMs, DEFAULT_RETRY_DELAY_MS);

  function keyOf(value) {
    const key = String(value ?? "").trim();
    if (!key) throw new TypeError("Observation session id is required.");
    return key;
  }

  function recordFor(sessionId) {
    return records.get(keyOf(sessionId)) ?? null;
  }

  function nextDueAt(record) {
    const ordinaryDue = record.lastObservedAt === null
      ? record.startedAt + initialDelay
      : record.lastObservedAt + interval;
    const retryDue = record.lastAttemptAt === null
      ? 0
      : record.lastAttemptAt + retryDelay;
    return Math.max(ordinaryDue, retryDue);
  }

  const api = {
    start(sessionId, { startedAt = now(), paused = false } = {}) {
      records.set(keyOf(sessionId), {
        startedAt,
        paused: Boolean(paused),
        lastAttemptAt: null,
        lastObservedAt: null,
        lastObservedVersion: null,
        reservedVersion: null,
      });
      return api.status(sessionId);
    },

    stop(sessionId) {
      records.delete(keyOf(sessionId));
    },

    due(sessionId, version) {
      const record = recordFor(sessionId);
      const candidate = String(version ?? "").trim();
      return Boolean(
        record
        && !record.paused
        && !record.reservedVersion
        && candidate
        && candidate !== record.lastObservedVersion
        && now() >= nextDueAt(record),
      );
    },

    reserve(sessionId, version) {
      if (!api.due(sessionId, version)) return false;
      const record = recordFor(sessionId);
      record.reservedVersion = String(version);
      record.lastAttemptAt = now();
      return true;
    },

    reservationIsCurrent(sessionId, version) {
      const record = recordFor(sessionId);
      return Boolean(
        record
        && !record.paused
        && record.reservedVersion === String(version ?? ""),
      );
    },

    complete(sessionId, version) {
      const record = recordFor(sessionId);
      if (!record) return;
      record.lastObservedAt = now();
      record.lastObservedVersion = String(version ?? record.reservedVersion ?? "") || null;
      record.reservedVersion = null;
    },

    release(sessionId) {
      const record = recordFor(sessionId);
      if (record) record.reservedVersion = null;
    },

    noteUserActivity(sessionId, version = null) {
      const record = recordFor(sessionId);
      if (!record) return;
      const timestamp = now();
      record.lastAttemptAt = timestamp;
      record.lastObservedAt = timestamp;
      if (version) record.lastObservedVersion = String(version);
    },

    setPaused(sessionId, paused) {
      const record = recordFor(sessionId);
      if (!record) return { enabled: false };
      const nextPaused = Boolean(paused);
      if (record.paused !== nextPaused) {
        record.paused = nextPaused;
        record.reservedVersion = null;
        const timestamp = now();
        record.lastAttemptAt = timestamp;
        record.lastObservedAt = timestamp;
      }
      return api.status(sessionId);
    },

    status(sessionId) {
      const record = recordFor(sessionId);
      if (!record) return { enabled: false };
      return {
        enabled: true,
        paused: record.paused,
        inFlight: Boolean(record.reservedVersion),
        lastObservedAt: record.lastObservedAt,
        lastObservedVersion: record.lastObservedVersion,
        nextObservationAt: nextDueAt(record),
        intervalMs: interval,
      };
    },
  };

  return api;
}
