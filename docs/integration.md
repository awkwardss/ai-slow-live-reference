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

## 3. A real voice turn

Voice creates a common integration trap: connecting image capture to every streaming audio chunk or reusing one abort controller for audio and camera work. Both make the system noisy and fragile.

The recommended model is **one finalized voice segment = one multimodal user turn**:

1. start or continue audio capture without changing the slow-live frame timer;
2. stream or buffer audio according to the application's voice design;
3. when the voice segment is finalized, create the ordinary user turn containing audio and/or transcription;
4. when that turn is ready for actual model dispatch, read the newest valid slow-live frame;
5. add location only if consent remains on and the sample is fresh;
6. record audio/transcript time and frame capture time;
7. revalidate session generation and frame version immediately before the provider write;
8. deliver one logical multimodal turn.

Do not attach an image to every partial transcript or audio packet. Do not abort camera capture when voice starts or ends. If the user stops slow live before the provider write, send the voice turn without the invalidated visual attachment.

```js
async function dispatchVoiceTurn({ sessionId, audio, transcript, generation }) {
  const frame = store.latestFrame(sessionId);
  if (!frame || !liveGenerationIsCurrent(sessionId, generation)) {
    return sendVoiceTurn({ audio, transcript });
  }

  scheduler.noteUserActivity(sessionId, frame.version);
  const visualContext = buildCompanionFrameEvent({ frame, mode: "user-turn" });

  if (!liveGenerationIsCurrent(sessionId, generation)
      || !store.isCurrent(sessionId, frame.version)) {
    return sendVoiceTurn({ audio, transcript });
  }

  return sendVoiceTurn({ audio, transcript, visualContext });
}
```

## 4. “Look here” / immediate inspection

An explicit “Look here” action has different semantics from an automatic observation:

1. request a fresh capture or select the freshest frame within a strict age limit;
2. associate it with an explicit user action or message;
3. display a receipt thumbnail and capture time so the user can verify what was sent;
4. dispatch it through the same user-turn adapter and version checks;
5. leave the background capture and observation intervals unchanged.

The receipt may be ordinary conversation UI, but it should not silently turn the ephemeral latest-frame slot into a media archive.

## 5. A proactive observation

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

## 6. Queue and race handling

Slow live is a latest-state feature, so queued work must be treated as a candidate rather than a promise. Before every model delivery:

- confirm the live generation is current;
- load or rebind the latest frame according to the product's declared semantics;
- reject expired frames;
- confirm the frame version still matches;
- confirm location remains explicitly enabled and fresh;
- avoid retrying a visual attachment after stop.

Do not let an older upload complete after a newer one and overwrite it. A production endpoint can use a capture sequence, generation, or monotonic timestamp to reject out-of-order updates.

## 7. Collapse, focus, and mobile lifecycle

Collapsing the player is a presentation change, not a session stop. The compact state should preserve active/location state, expand and stop controls, and ordinary incoming/outgoing message delivery.

Likewise, a chat composer losing focus should not itself block queued sends or incoming replies. Camera continuation in the background is platform-dependent, so distinguish UI focus from actual browser/native lifecycle state. Handle backgrounding, lock-screen suspension, permission revocation, process death, and resume explicitly.

## 8. Stop propagation

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
- hands-free interaction requirements for any driving use case.

## Failure modes and lessons learned

| Failure mode | Why it happens | Prevention |
| --- | --- | --- |
| Capture cadence freezes after a slow upload | The next timer is scheduled only after completion | Arm the cadence independently; allow one bounded upload in flight |
| Voice works but slow live stops | Audio and camera share an abort controller or exclusive flag | Separate cancellation domains; pause only proactive AI responses when necessary |
| Voice sends many duplicate pictures | Each audio/transcript chunk attaches the latest frame | Attach one frame when the logical voice turn is finalized/dispatched |
| Queued text or voice carries an old scene | Frame was captured only at tap time | Rebind and revalidate at actual dispatch |
| AI responds to every capture | Capture and observation rates are treated as the same | Use a slower scheduler with unseen-version and user-activity checks |
| AI history says the user sent photos they did not send | Automatic observations are fabricated as user turns | Use explicit application observation events |
| Old frame arrives after stop | Prepared work is not tied to a generation/version | Revalidate immediately before network write and invalidate on stop |
| Location remains after toggle-off | Location is only omitted from future uploads | Clear the browser sample and server copy immediately |
| Preview becomes a narrow cropped strip | Source ratio and `object-fit: cover` conflict | Request a suitable camera ratio and use `contain` when edges matter |
| Collapsing or losing focus breaks chat | UI visibility is incorrectly used as delivery authority | Keep message transport independent from presentation state |
