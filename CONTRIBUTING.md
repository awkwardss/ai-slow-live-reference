# Contributing

Thank you for helping improve AI Slow Live Reference.

This project was created together by Xiaoxu and CC. Contributions are welcome when they preserve the repository's narrow purpose: a small, privacy-first reference for low-frequency visual context rather than a production chat product or surveillance system.

## Before opening a change

1. Keep private-product code, prompts, credentials, endpoints, conversations, real locations, and deployment configuration out of the repository.
2. Preserve separate, explicit consent for camera and location.
3. Keep the latest-frame-only default. New media retention must not be introduced implicitly.
4. Treat stop as a hard lifecycle boundary that invalidates in-flight and queued work.
5. Do not fabricate user messages for automatic observations.
6. Keep text, voice, camera, and location cancellation scopes explicit.
7. Add or update tests for behavior changes.

Run the local checks before submitting:

```bash
npm install
npm run check
```

For integration changes, explain which part is runnable in this repository and which part remains the responsibility of the host application. For privacy or lifecycle changes, include the failure mode being prevented.

## 中文

感谢你参与改进 AI 慢直播参考实现。

本项目由小序与 CC 共同开发。我们欢迎围绕低频视觉上下文、隐私边界和可迁移接入方案的改进，但不希望它在不知不觉中变成完整聊天产品、持续监控系统或私人应用源码的公开镜像。

提交修改前，请确保：

1. 不包含私人产品源码、提示词、凭据、地址、对话、真实位置或部署配置；
2. 相机与位置分别、明确授权；
3. 默认仍然只保留最新一帧，不暗中增加历史留存；
4. “结束”会使在途和排队任务一起失效；
5. 自动观察不会伪造成用户消息；
6. 文字、语音、相机与位置的取消范围保持清晰；
7. 行为变化配有相应测试。

提交前请运行 `npm run check`。如果修改涉及宿主应用接入，请明确区分仓库已实现部分与仍需接入方自行完成的部分。
