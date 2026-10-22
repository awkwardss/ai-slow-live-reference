# Integration guide

This repository supplies primitives, not a chat product. A production integrator needs to connect four boundaries.

## 1. Session ownership

Replace the demo's random URL identifier with an authenticated session owned by the signed-in user. Every start, frame update, status read, location clear, and stop request must verify ownership server-side. Do not treat an unguessable URL as authorization.

## 2. A real user turn

When the user sends a normal message while slow live is active:

1. read `store.latestFrame(sessionId)` at actual dispatch time, not when the message first entered a queue;
2. attach that image as application-provided context;
3. include location only when it remains fresh and explicitly shared;
4. call `scheduler.noteUserActivity(sessionId, frame.version)`;
5. immediately before the provider request, confirm `store.isCurrent(sessionId, frame.version)`.

Reading at dispatch time matters because a queued message can wait while the camera continues to update. It should carry the newest permitted scene, not an early frame captured when the user first pressed Send.

## 3. A proactive observation

Run a low-frequency worker only while the live session is active:

```js
const frame = store.latestFrame(sessionId);
if (frame && scheduler.reserve(sessionId, frame.version)) {
  try {
    if (store.isCurrent(sessionId, frame.version)
        && scheduler.reservationIsCurrent(sessionId, frame.version)
        && !conversationHasPendingWriter(sessionId)) {
      await sendApplicationObservation(
        buildCompanionFrameEvent({ frame, mode: "proactive-observation" }),
      );
      scheduler.complete(sessionId, frame.version);
    }
  } finally {
    scheduler.release(sessionId);
  }
}
```

The model input must identify this as application context. Never synthesize text such as “the user sent another photo” or insert a fake user message solely to trigger the model.

## 4. Stop propagation

Stop is a hard boundary:

- stop browser camera tracks;
- stop the geolocation watcher;
- abort in-flight uploads;
- clear capture timers;
- delete the server session and latest frame;
- cancel or invalidate queued model deliveries;
- release observation reservations.

A network failure during the stop request must not keep the local camera running. Production servers should also enforce short inactivity expiry so orphaned sessions disappear.

## Recommended production additions

- TLS and secure, rotating session cookies or signed bearer tokens;
- same-origin/CSRF protection and strict CORS policy;
- per-user and per-session rate limits;
- explicit frame size, type, and decode validation;
- an application-level stop token or generation counter;
- structured audit events that contain state transitions but no media or coordinates;
- provider-specific retention and deletion configuration;
- mobile lifecycle handling for background, lock-screen, and permission revocation.
