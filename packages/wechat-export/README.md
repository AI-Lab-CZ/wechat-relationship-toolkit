# WeChat Export Layer

这一层负责把微信会话导出到本地文件，稳定路线基于 `@jackwener/wx-cli`。

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
