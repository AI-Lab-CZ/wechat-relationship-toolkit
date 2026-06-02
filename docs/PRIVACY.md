# 隐私与开源检查清单

这个项目处理的是高度敏感的个人聊天数据。开源前请先跑完本清单。

## 永远不要提交

```text
output/
.wx-cli/
all_keys.json
wx_sessions.json
wx_contacts.json
relationship_samples/
exports/
*.db
*.sqlite
*.sqlite3
*.zip
*.log
.env
```

当前整理出的真实数据包裹位于：

```text
C:\Users\59363\Documents\微信信息处理-private-20260603\
```

## README 图片规则

README 图片必须来自合成数据：

```text
examples/demo-data/
docs/assets/export-ui-demo.png
docs/assets/relationship-graph-demo.png
```

不要使用真实截图后打码。打码容易漏掉头像、群名、缩略图、聊天摘要、路径、时间线等细节。

## 开源前命令

```powershell
git status --short
rg "wxid_|gh_|all_keys|db_storage|手机号|真实姓名|抖音 codex|汇星|GEMINI_API_KEY=" .
```

如果命中真实姓名、手机号、wxid、群名、业务名或聊天内容，先移出仓库再提交。

## AI 调用边界

默认不启用 AI 分析。只有设置：

```env
ENABLE_AI_ANALYSIS=true
GEMINI_API_KEY=...
```

后端才会调用 Gemini。默认只发送图谱摘要，不发送原始聊天全文。
