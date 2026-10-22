# Related work

Slow live sits near several established patterns: periodically sampled camera context, real-time multimodal sessions, and frame-processing pipelines. The projects below are useful comparisons, not sources for this repository's code.

| Project | Relevant capability | License | Difference from this reference |
| --- | --- | --- | --- |
| [zyads/eyes](https://github.com/zyads/eyes) | Sends phone-camera context to an AI and emphasizes the latest view | MIT | A complete product with its own interaction model; this repository focuses on a vendor-neutral, ephemeral latest-frame lifecycle. |
| [LiveKit Vision Demo](https://github.com/livekit-examples/vision-demo) | Combines real-time voice and periodically sampled video frames | Apache-2.0 | Built around LiveKit real-time rooms; this reference uses low-frequency HTTP stills and no media-room dependency. |
| [Google Gemini Live Studio](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api/gemini-live-studio) | Streams camera or screen context into a live multimodal model session | Apache-2.0 | Model- and cloud-specific live-session demo; this reference keeps the model adapter out of the capture/store core. |
| [Pipecat](https://github.com/pipecat-ai/pipecat) | Provides multimodal pipelines capable of transporting and processing image frames | BSD-2-Clause | A broad real-time agent framework; this repository is a narrowly scoped architectural reference. |
| [OpenAI Realtime image input](https://developers.openai.com/api/docs/guides/realtime-conversations) | Accepts images in a real-time conversation | Documentation/API | An integration target, not a complete slow-live lifecycle or retention design. |

Functional similarity is expected: browser media capture, image compression, geolocation, and latest-value storage are common platform patterns. This repository does not claim those ideas as unique.
