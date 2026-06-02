# WeChat Relationship Graph

关系图谱前端。默认加载仓库里的合成 demo 数据，不读取真实微信聊天记录。

## Run Locally

```powershell
npm install --registry=https://registry.npmjs.org
npm run dev
```

AI 分析默认关闭。复制 `.env.example` 为 `.env`，设置 `ENABLE_AI_ANALYSIS=true` 和 `GEMINI_API_KEY` 后才会调用 Gemini。
