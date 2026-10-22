# AI Slow Live Reference

A small, privacy-first reference implementation for sharing an intentionally low-frequency view of everyday life with an AI companion.

This is **not** a drop-in plugin for any chat product. It demonstrates the hard parts that an integrator can adapt to their own stack:

- browser camera capture on an independent cadence;
- a server-side, memory-only **latest frame** store;
- optional, explicitly enabled, ephemeral geolocation;
- a hard stop boundary that invalidates retained and in-flight frames;
- a compact mini-player that keeps the live preview and essential controls visible;
- a scheduler for low-frequency proactive observations without inventing a user message;
- a clean adapter boundary for attaching the latest frame to an actual user turn.

The demo has no AI vendor dependency. The integration boundary is documented so that the application—not this library—owns model choice, authentication, conversation state, and message delivery.

## Why “slow live”?

Full video streaming is often unnecessary when the goal is companionship rather than surveillance or telepresence. A fresh still every few seconds can preserve a sense of shared presence while reducing bandwidth, retention, and accidental over-collection.

The design principle is simple:

> Keep the camera locally visible, transmit only periodic compressed frames, retain only the newest frame in memory, and erase the session on stop.

## Run the local demo

Requirements: Node.js 22 or newer and a browser with camera support.

```bash
npm install
npm test
npm start
```

Open `http://127.0.0.1:8787`. Camera and geolocation permissions are requested only after you use the corresponding controls.

The demo server binds to loopback by default. It is deliberately **not production-ready** and should not be exposed to a network as-is.

## Repository map

```text
public/                     Browser demo and compact player
src/live-session-store.mjs Memory-only latest-frame lifecycle
src/location.mjs           Location validation and expiry
src/observation-scheduler.mjs
                            Proactive observation cadence and reservation
src/server.mjs             Loopback-only demonstration API
docs/architecture.md       System boundaries and event flow
docs/integration.md        AI/chat integration contract
docs/privacy-threat-model.md
                            Privacy and deployment risks
docs/prepublication-audit.md
                            Provenance and release audit
RELATED_WORK.md            Similar projects and differences
PROVENANCE.md              Clean-room authorship record
```

## What this repository does not provide

- no account system or internet-facing authorization;
- no durable media storage or replay history;
- no reverse geocoding or route history;
- no model credentials, vendor SDK, or private prompt;
- no linkage to a private application, conversation database, or production bridge;
- no guarantee that a browser tab remains active while a phone is locked or heavily backgrounded.

## Privacy defaults

1. Location starts off and is separate from camera consent.
2. The server keeps one frame per active session and never writes it to disk.
3. A new frame replaces the previous frame.
4. Stop removes the session immediately; queued consumers must re-check the frame version before use.
5. Location expires independently and is cleared immediately when its toggle is switched off.
6. Proactive observations are application events, not fabricated user turns.

See [the threat model](docs/privacy-threat-model.md) before adapting this design.

## 中文说明

这是一个面向开发者的“AI 慢直播”基础参考实现，不是可以直接安装进聊天应用的成品插件。

它演示的是一组可迁移的机制：网页相机每隔数秒压缩并上传一帧；服务端只在内存里保留最新一帧；位置共享必须单独、明确开启；关闭位置会立刻清空临时坐标，结束直播会立刻使整个会话失效；AI 的主动观察不能伪造成用户刚刚发来的一条消息。

仓库不包含任何私人应用的源码、地址、账号、提示词、真实坐标或聊天数据。接入者仍需自行实现身份认证、消息队列、模型调用、生产部署和用户界面。

## License status

No public license has been granted yet. The repository remains private while the pre-publication audit and license choice are completed. Until a license file is added, normal copyright defaults apply.
