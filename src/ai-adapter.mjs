import { freshLocation, locationSummary } from "./location.mjs";

export function buildCompanionFrameEvent({ frame, mode = "user-turn", now = Date.now() }) {
  if (!frame?.bytes || !frame?.version) throw new TypeError("A current frame is required.");
  if (!new Set(["user-turn", "proactive-observation"]).has(mode)) {
    throw new TypeError("Unknown companion frame event mode.");
  }

  const location = freshLocation(frame.location, { now });
  return {
    kind: mode,
    frame: {
      bytes: Buffer.from(frame.bytes),
      contentType: frame.contentType ?? "image/jpeg",
      version: frame.version,
      capturedAt: frame.updatedAt,
    },
    location: location ? locationSummary(location, { now }) : null,
    semantics: mode === "user-turn"
      ? "Attach this latest frame as application-provided context to the real user turn."
      : "Create an application observation event. Do not fabricate or attribute a new user message.",
    retention: "Ephemeral context only; do not persist media or precise location by default.",
  };
}

export async function consumeReservedObservation({
  sessionId,
  store,
  scheduler,
  deliver,
}) {
  const first = store.latestFrame(sessionId);
  if (!first || !scheduler.reserve(sessionId, first.version)) return { delivered: false };

  try {
    const latest = store.latestFrame(sessionId);
    if (
      !latest
      || !store.isCurrent(sessionId, latest.version)
      || !scheduler.reservationIsCurrent(sessionId, first.version)
      || latest.version !== first.version
    ) {
      return { delivered: false };
    }
    await deliver(buildCompanionFrameEvent({ frame: latest, mode: "proactive-observation" }));
    if (!store.isCurrent(sessionId, latest.version)) return { delivered: false };
    scheduler.complete(sessionId, latest.version);
    return { delivered: true, version: latest.version };
  } finally {
    scheduler.release(sessionId);
  }
}
