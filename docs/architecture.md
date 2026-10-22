# Architecture

## Core flow

```text
camera preview (continuous and local)
        |
        | every few seconds: canvas -> compressed JPEG
        v
authenticated application endpoint
        |
        | replace, never append
        v
memory-only latest-frame slot  <---- optional fresh location sample
        |
        +---- attach to a real user turn
        |
        +---- reserve for a low-frequency application observation
                     |
                     +---- revalidate version and session immediately before delivery
```

The reference demo implements the browser, HTTP, and latest-frame portions. The AI adapter is deliberately a contract rather than a vendor call.

## Components

### Browser capture

The browser displays a continuous local preview but creates a compressed JPEG only on a timer. The timer is armed independently from upload completion so unrelated chat or audio activity cannot silently reset the camera cadence. Only one upload is allowed in flight; a slow request is aborted after a bounded timeout and the next scheduled capture can continue.

Location has a separate permission and toggle. Switching it off clears the browser's latest sample and asks the server to erase the in-memory copy immediately. Each frame also carries an explicit shared/not-shared bit so an old location cannot survive after the user disables sharing.

### Latest-frame store

The store holds at most one `Buffer` per active session. A new frame replaces the old buffer. It also records a short content hash (`version`) so delayed work can determine whether the frame it prepared is still current.

The session expires after inactivity. `stop()` removes the whole record immediately. There is no filesystem write path.

### Observation scheduler

The scheduler rate-limits optional proactive observations. It separates these operations:

1. `due`: decide whether a new, unseen frame is eligible;
2. `reserve`: prevent two workers from consuming it concurrently;
3. revalidate: confirm the live session, reserved version, and newest frame still agree;
4. `complete`: record successful observation;
5. `release`: permit retry after a race or delivery failure.

Active voice or another exclusive writer can pause observation generation without stopping capture. A real user turn should call `noteUserActivity` so the system does not immediately follow it with an unsolicited observation.

### AI adapter boundary

`buildCompanionFrameEvent` creates a vendor-neutral event with two modes:

- `user-turn`: application context attached to a real user message;
- `proactive-observation`: an application event that must not be represented as a new user utterance.

The application is responsible for translating the event into its model provider's supported image format and for applying its own privacy/memory policy.

## Cancellation limits

Version checks can prevent a queued or prepared frame from being delivered after stop. They cannot retract bytes already sent to a remote model. A production adapter should therefore:

- check `store.isCurrent(sessionId, version)` immediately before the network write;
- pass an abort signal tied to session stop when the model SDK supports cancellation;
- avoid retries after stop;
- configure the model provider's data retention deliberately.
