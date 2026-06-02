# API 接入说明

关系图谱前端不依赖 AI API。不开启 Gemini 时，图谱浏览、筛选、节点详情都可以正常使用。

## 启用 Gemini 分析

在 `apps/relationship-graph/.env` 中填写：

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
ENABLE_AI_ANALYSIS=true
PORT=3000
```

然后运行：

```powershell
cd apps\relationship-graph
npm run dev
```

## 默认安全行为

`ENABLE_AI_ANALYSIS=false` 时：

- `/api/graph` 正常返回本地图谱数据。
- `/api/analyze` 返回 403，不会调用 Gemini。
- API key 不会暴露给浏览器。

`ENABLE_AI_ANALYSIS=true` 时，后端会把节点和边的摘要发送给 Gemini，包括：

- 联系人展示名
- 关系分类
- 关系强度、湿度、商业价值等分数
- 消息数量
- 最近活跃时间
- 关系摘要

不会发送原始聊天全文，除非你自己修改服务端逻辑。

## 替换模型

可以通过环境变量切换模型：

```env
GEMINI_MODEL=gemini-2.5-flash
```

如果模型名称失效，优先查看 Google Gemini 官方文档并更新 `.env`。

## 给使用者的提醒

AI 输出必须带上“不确定性”语气。项目内置提示词要求使用“疑似、倾向于、算法推测、样本倾向”等表述，避免把启发式分类当成事实。
