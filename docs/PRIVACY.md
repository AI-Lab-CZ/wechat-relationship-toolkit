# 隐私、账号风险与开源检查清单

这个项目处理的是高度敏感的个人聊天数据。真实微信数据导出还可能触发微信客户端或账号风控。开源、演示、运行真实导出前，请先读完本清单。

## 账号风险

真实微信数据导出、数据库读取、key 探测、批量扫描等行为可能被微信识别为异常环境或异常访问，进而触发登录验证、功能限制或其他风控。

建议：

- 优先只运行 demo 数据。
- 不要短时间内反复运行导出或扫描。
- 不要在账号已出现异常提示时继续运行工具。
- 不要运行自己不理解的 key probing、decrypt、database scanning 脚本。
- 如需备份，优先使用微信官方备份/迁移功能。

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

真实数据包裹应放在仓库目录之外，例如同级的私有目录。不要把本机用户名、绝对路径或私有目录名写进公开文档。

## README 图片规则

README 图片必须来自合成数据：

```text
examples/demo-data/
docs/assets/export-ui-demo.png
docs/assets/relationship-graph-demo.png
docs/assets/relationship-graph-demo.gif
```

不要使用真实截图后打码。打码容易漏掉头像、群名、缩略图、聊天摘要、路径、时间线等细节。

## 开源前命令

```powershell
git status --short
rg "wxid_|gh_|all_keys|db_storage|手机号|真实姓名|真实群名|真实项目名|GEMINI_API_KEY=" .
```

如果命中真实姓名、手机号、wxid、群名、业务名或聊天内容，先移出仓库再提交。

## AI 调用边界

默认不启用 AI 分析。只有设置：

```env
ENABLE_AI_ANALYSIS=true
GEMINI_API_KEY=...
```

后端才会调用 Gemini。默认只发送图谱摘要，不发送原始聊天全文。
