# WeChat Relationship Toolkit

一个本地优先的微信记忆整理实验工具，用图谱帮你重新看见关系和信息沉淀。

A local-first experimental WeChat memory tool that helps you rediscover relationships and information through graphs.

![关系图谱交互演示](docs/assets/relationship-graph-demo.gif)

把散落在微信里的聊天、联系人和群组，整理成可导出、可分析、可视化的个人关系图谱。默认使用合成 demo 数据演示；真实聊天记录不会进入仓库，也不会默认上传到任何外部 API。

## Risk Notice

This project is an experimental local data tool. WeChat data extraction may violate platform expectations, trigger client or account risk controls, or cause temporary login / verification issues.

本项目是实验性质的本地数据工具。真实微信数据导出、数据库读取、key 探测、批量扫描等行为可能触发微信客户端或账号风控，导致登录验证、功能限制或其他账号风险。请优先使用 demo 数据；真实微信数据导出属于高级用法，风险自担。

Do not run extraction repeatedly. Do not run key probing or database scanning while you are unsure what the tool is doing. Prefer official WeChat backup / migration features for account safety.

![微信导出 UI](docs/assets/export-ui-demo.png)

![关系图谱 UI](docs/assets/relationship-graph-demo.png)

## 为什么做这个

微信里沉淀了大量关系、业务、项目和生活记忆，但它们通常被锁在聊天列表里，很难被重新整理和观察。

这个项目尝试用一种克制的方式处理这些数据：

- 本地优先，真实数据默认只留在你的电脑上。
- 先导出，再处理，再可视化，三层分开。
- 关系判断只做启发式分析，不把标签当成事实。
- AI 分析默认关闭，需要你显式配置 API key 才会启用。
- 真实微信数据导出存在账号风险，默认推荐只跑 demo。

## 三层结构

```text
apps/
  export-ui/              # 本地微信导出界面，高风险高级用法
  relationship-graph/     # 关系图谱前端，可选 Gemini 分析

packages/
  wechat-export/          # 导出层脚本，基于 @jackwener/wx-cli
  relationship-engine/    # 数据处理层：会话 -> 关系图谱 JSON/CSV

examples/
  demo-data/              # 合成演示数据

docs/
  API.md                  # API 接入说明
  PRIVACY.md              # 隐私与开源检查清单
  assets/                 # README 演示截图和 GIF
```

## 快速开始：只跑 demo

推荐先只运行图谱前端。它默认加载 `examples/demo-data/relationship-graph.demo.json`，不会读取真实微信数据。

```powershell
cd apps\relationship-graph
npm install --registry=https://registry.npmjs.org
npm run dev
```

打开 `http://localhost:3000` 查看 demo 关系图谱。

## 高级用法：真实微信导出

真实微信导出可能触发微信风控。请在理解风险后再使用，不要反复运行，不要在账号状态异常时运行。

```powershell
npx @jackwener/wx-cli init --force
.\packages\wechat-export\start_export_ui.ps1
```

打开 `http://127.0.0.1:4789` 后，可以刷新会话，再指定联系人导出 Markdown、TXT、JSON 或 YAML。

没有真实会话文件时，导出 UI 会显示合成 demo 会话，方便预览界面。

## 数据处理层

```powershell
python .\packages\relationship-engine\build_relationship_graph.py
```

处理脚本默认读取本地 `output/wx_sessions.json` 和导出的样本聊天记录，输出：

```text
output/gemini_relationship_materials/relationship-graph.json
output/gemini_relationship_materials/nodes.csv
output/gemini_relationship_materials/edges.csv
```

这些真实输出默认被 `.gitignore` 排除，不要提交。

## Gemini/API 接入

AI 分析默认关闭。需要时在 `apps/relationship-graph/.env` 里显式开启：

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
ENABLE_AI_ANALYSIS=true
PORT=3000
```

更多说明见 [docs/API.md](docs/API.md)。

## 隐私原则

- 不提交 `output/`、`.wx-cli`、真实聊天记录、真实联系人、数据库、日志、zip。
- README 图片只用 demo 数据截图。
- AI 分析只发送图谱摘要，不发送原始聊天全文。
- 关系标签是启发式结果，只能作为观察线索，不能当作事实判断。
- 真实微信导出可能触发账号风控，使用者自行承担风险。

开源前检查清单见 [docs/PRIVACY.md](docs/PRIVACY.md)。

## 开源前检查

```powershell
git status --short
rg "wxid_|gh_|all_keys|db_storage|手机号|真实姓名|真实群名|真实项目名|GEMINI_API_KEY=" .
```

如果以上搜索命中真实个人数据，先移到仓库外的私有包裹再提交。
