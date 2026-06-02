# WeChat Export Layer

这一层负责把微信会话导出到本地文件，稳定路线基于 `@jackwener/wx-cli`。

## Risk Notice

真实微信导出属于高风险高级用法。运行 `wx-cli init`、读取微信数据库、导出聊天记录或做任何 key 探测，都可能触发微信客户端或账号风控。

请不要在账号异常、刚完成验证、频繁登录/退出、或不理解工具行为时运行导出。优先使用微信官方备份/迁移能力保存重要数据。

## 使用

```powershell
npx @jackwener/wx-cli init --force
.\packages\wechat-export\start_export_ui.ps1
```

导出 UI 默认读取仓库根目录的 `output/wx_sessions.json`。也可以通过环境变量指定：

```powershell
$env:WECHAT_OUTPUT_DIR="D:\your-output-dir"
node .\apps\export-ui\server.js
```

真实导出产物默认写入 `output/`，并被 `.gitignore` 排除。
