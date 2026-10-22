# Privacy and threat model

Camera frames and precise coordinates are highly sensitive. “Only the latest frame” reduces exposure; it does not make an unauthenticated deployment safe.

## Protected data

- camera frames and anything visible in them;
- precise coordinates, speed, heading, and inferred route;
- whether a live session exists;
- association between the session, account, and conversation;
- model inputs and outputs derived from the scene.

## Intended guarantees of the reference core

- no frame or location persistence to disk;
- at most one retained frame per active session;
- automatic inactivity expiry;
- explicit location opt-in;
- immediate location clear without stopping camera capture;
- immediate session removal on stop;
- version checks for delayed consumers;
- no fabricated user turn for proactive observation.

## Threats not solved by the demo

### Unauthorized network access

The demo has no user accounts. It binds to loopback and must not be exposed directly. A real deployment needs authentication and authorization on every endpoint, TLS, request-rate limits, origin controls, and careful logging.

### Model-provider retention

Once a frame is sent to a model provider, local deletion cannot erase a provider-side copy. Review provider settings and contracts, minimize metadata, and communicate the retention boundary accurately to users.

### Logs and observability

Reverse proxies, exception trackers, request dumpers, and tracing systems can accidentally retain headers or bodies. Never log JPEG bodies or precise location headers. Redact session identifiers where possible.

### Background behavior

Mobile browsers and embedded web views can pause timers, cameras, or networking when backgrounded. Do not promise uninterrupted capture. Treat missing frames as stale and expire them.

### People in the scene

The camera may include bystanders, documents, screens, addresses, or vehicle plates. Product policy and interface design should make the active camera state obvious and provide a one-action stop.

### Location inference without GPS

Disabling geolocation does not prevent visual inference from landmarks or signs. The UI should describe “location off” accurately as “no device coordinates attached,” not “the scene cannot reveal where you are.”

## Safer production defaults

- location off on every new live session;
- a conspicuous persistent camera indicator;
- short server TTL and no retry after stop;
- lower image resolution and JPEG quality unless detail is requested explicitly;
- no recording/history feature by default;
- no reverse geocoding by default;
- no precise location in long-term memory or analytics;
- clear distinction between a user message and an application observation.
