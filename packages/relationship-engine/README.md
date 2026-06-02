# Relationship Engine

这一层把微信会话和聊天样本转换成前端可消费的关系图谱。

## 输入

```text
output/wx_sessions.json
output/relationship_samples/*.json
```

## 输出

```text
output/gemini_relationship_materials/relationship-graph.json
output/gemini_relationship_materials/nodes.csv
output/gemini_relationship_materials/edges.csv
```

## 运行

```powershell
python .\packages\relationship-engine\build_relationship_graph.py
```

输出文件可能包含真实联系人和关系摘要，默认不要提交。
