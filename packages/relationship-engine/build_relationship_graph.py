import csv
import json
import math
import re
import subprocess
from collections import Counter
from pathlib import Path


WORKSPACE = Path(__file__).resolve().parents[2]
OUTPUT = WORKSPACE / "output"
MATERIALS = OUTPUT / "gemini_relationship_materials"
SAMPLES = OUTPUT / "relationship_samples"
SESSIONS_JSON = OUTPUT / "wx_sessions.json"

MAX_SESSIONS = 140
SAMPLE_LIMIT = 160

EXCLUDED_USERNAMES = {
    "brandsessionholder",
    "brandservicesessionholder",
    "@placeholder_foldgroup",
    "filehelper",
    "floatbottle",
    "weixin",
}

BUSINESS_WORDS = {
    "客户", "收款", "付款", "订单", "报价", "合同", "合作", "项目", "方案", "产品", "品类", "供应",
    "老板", "渠道", "跨境", "独立站", "电商", "财税", "招聘", "兼职", "工资", "利润", "门店",
    "发票", "转账", "定金", "尾款", "采购", "销售", "运营", "招商", "推广", "账号", "私域",
}
EMOTION_WORDS = {
    "哈哈", "😂", "🤣", "想你", "喜欢", "爱", "亲", "宝", "老婆", "老公", "抱抱", "晚安",
    "早安", "开心", "难过", "委屈", "生气", "谢谢", "感谢", "兄弟", "姐妹", "朋友", "家",
    "爸", "妈", "哥", "姐", "弟", "妹", "叔", "姨", "舅", "阿嬷",
}
ROMANCE_WORDS = {"想你", "喜欢你", "爱你", "宝贝", "老婆", "老公", "亲爱的", "抱抱", "晚安", "约会"}
FAMILY_WORDS = {"爸爸", "妈妈", "爸", "妈", "老妈", "老爸", "哥哥", "姐姐", "弟弟", "妹妹", "叔", "姨", "舅", "阿嬷", "家"}
SUPPLIER_WORDS = {"供应", "采购", "设备", "批发", "厂家", "安装", "售后", "货", "发货", "报价"}
CUSTOMER_WORDS = {"客人", "客户", "柜", "预约", "收款", "已收款", "消费", "台球", "球房"}
GROUP_BUSINESS_WORDS = {"招聘", "兼职", "交流", "电商", "财税", "招商", "设计", "运营", "推荐官"}

STOP_TYPES = {"official_account", "folded"}


def read_json_smart(path: Path):
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-16", "utf-16-le", "gb18030"):
        try:
            return json.loads(raw.decode(enc))
        except Exception:
            pass
    raise ValueError(f"Cannot read JSON: {path}")


def clean_text(value) -> str:
    if value is None:
        return ""
    text = str(value)
    return re.sub(r"\s+", " ", text).strip()


def safe_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', "_", name).strip()
    return name[:96] or "chat"


def should_keep_session(row: dict) -> bool:
    username = row.get("username", "")
    chat_type = row.get("chat_type", "")
    chat = row.get("chat", "")
    if chat_type in STOP_TYPES:
        return False
    if username in EXCLUDED_USERNAMES:
        return False
    if username.startswith("gh_"):
        return False
    if "公众号" in chat or "文件传输助手" in chat:
        return False
    return chat_type in {"private", "group"} or row.get("is_group")


def run_export(chat: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists() and out_path.stat().st_size > 20:
        return
    cmd = [
        "npx.cmd",
        "@jackwener/wx-cli",
        "export",
        chat,
        "--format",
        "json",
        "--limit",
        str(SAMPLE_LIMIT),
        "--output",
        str(out_path),
    ]
    subprocess.run(cmd, cwd=WORKSPACE, check=False, capture_output=True, text=True, encoding="utf-8", errors="ignore")


def load_sample(path: Path) -> dict:
    if not path.exists() or path.stat().st_size < 20:
        return {"messages": []}
    try:
        return read_json_smart(path)
    except Exception:
        return {"messages": []}


def keyword_counts(text: str, words: set[str]) -> int:
    return sum(text.count(word) for word in words if word)


def top_keywords(text: str) -> list[str]:
    candidates = []
    for word_set in (BUSINESS_WORDS, EMOTION_WORDS, CUSTOMER_WORDS, SUPPLIER_WORDS, GROUP_BUSINESS_WORDS):
        candidates.extend([w for w in word_set if w in text])
    counts = Counter(candidates)
    return [word for word, _ in counts.most_common(10)]


def clamp(value, lo=0, hi=100):
    return max(lo, min(hi, int(round(value))))


def classify_relation(row: dict, text: str, msg_count: int):
    chat = clean_text(row.get("chat"))
    username = row.get("username", "")
    is_group = bool(row.get("is_group"))
    haystack = f"{chat} {row.get('summary', '')} {text}"

    business_hits = keyword_counts(haystack, BUSINESS_WORDS)
    emotion_hits = keyword_counts(haystack, EMOTION_WORDS)
    romance_hits = keyword_counts(haystack, ROMANCE_WORDS)
    family_hits = keyword_counts(haystack, FAMILY_WORDS)
    supplier_hits = keyword_counts(haystack, SUPPLIER_WORDS)
    customer_hits = keyword_counts(haystack, CUSTOMER_WORDS)
    group_business_hits = keyword_counts(haystack, GROUP_BUSINESS_WORDS)

    if is_group:
        if group_business_hits + business_hits >= 2:
            relation = "business_group"
            label = "业务群"
        else:
            relation = "group"
            label = "群聊"
    elif family_hits >= 2 or re.search(r"(妈妈|爸爸|老妈|老爸|阿嬷|姐|哥|弟|妹)", chat):
        relation = "family"
        label = "家人亲属"
    elif romance_hits >= 2:
        relation = "romance"
        label = "亲密/暧昧"
    elif customer_hits >= 2 or "客人" in chat:
        relation = "customer"
        label = "客户"
    elif supplier_hits >= 2:
        relation = "supplier"
        label = "供应商/服务商"
    elif business_hits >= 3:
        relation = "business"
        label = "生意伙伴"
    elif emotion_hits >= 2 or re.search(r"(朋友|兄弟|姐妹|同学)", chat):
        relation = "brother"
        label = "朋友兄弟"
    else:
        relation = "weak"
        label = "普通/弱关系"

    strength = clamp(20 + min(45, math.log1p(max(msg_count, 1)) * 10) + min(25, len(text) / 280))
    wetness = clamp(20 + emotion_hits * 7 + romance_hits * 10 + family_hits * 8 - business_hits * 2)
    business_value = clamp(10 + business_hits * 8 + customer_hits * 10 + supplier_hits * 7 + group_business_hits * 6)
    if relation in {"business", "customer", "supplier", "business_group"}:
        value_score = clamp(35 + business_value * 0.55 + strength * 0.2)
    elif relation in {"family", "romance", "brother"}:
        value_score = clamp(25 + wetness * 0.35 + strength * 0.25)
    else:
        value_score = clamp(15 + strength * 0.25 + business_value * 0.15)
    intimacy = clamp(15 + wetness * 0.55 + strength * 0.2)

    confidence = 0.45
    if max(business_hits, emotion_hits, family_hits, romance_hits, customer_hits, supplier_hits) >= 3:
        confidence = 0.78
    elif max(business_hits, emotion_hits, customer_hits, supplier_hits) >= 1:
        confidence = 0.62
    if is_group:
        confidence = min(confidence, 0.68)

    return {
        "relation": relation,
        "relation_label": label,
        "strength": strength,
        "wetness": wetness,
        "business_value": business_value,
        "value_score": value_score,
        "intimacy": intimacy,
        "confidence": round(confidence, 2),
        "keywords": top_keywords(haystack),
    }


def build_summary(row: dict, features: dict, msg_count: int) -> str:
    label = clean_text(row.get("chat"))
    relation = features["relation_label"]
    keywords = "、".join(features["keywords"][:5]) or "暂无明显关键词"
    return f"{label} 被初步归为「{relation}」，样本消息 {msg_count} 条，关键词：{keywords}。该判断为启发式分析，置信度 {features['confidence']}。"


def main():
    MATERIALS.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)

    data = read_json_smart(SESSIONS_JSON)
    sessions = data.get("sessions", data if isinstance(data, list) else [])
    kept = [row for row in sessions if should_keep_session(row)]
    kept = sorted(kept, key=lambda r: r.get("timestamp", 0), reverse=True)[:MAX_SESSIONS]

    nodes = [
        {
            "id": "me",
            "label": "我",
            "type": "self",
            "category": "self",
            "value_score": 100,
            "wetness": 100,
            "intimacy": 100,
            "business_value": 100,
            "message_count": 0,
            "last_active": "",
            "tags": ["中心节点"],
            "confidence": 1,
            "summary": "中心节点。",
        }
    ]
    edges = []

    for index, row in enumerate(kept, start=1):
        chat = clean_text(row.get("chat")) or clean_text(row.get("username"))
        username = clean_text(row.get("username")) or f"chat_{index}"
        sample_path = SAMPLES / f"{index:03d}_{safe_filename(chat)}.json"
        run_export(chat, sample_path)
        sample = load_sample(sample_path)
        messages = sample.get("messages") or []
        msg_text = " ".join(clean_text(m.get("content")) for m in messages if isinstance(m, dict))
        msg_count = int(sample.get("count") or len(messages) or 0)
        features = classify_relation(row, msg_text, msg_count)
        last_active = ""
        if messages:
            last_active = clean_text(messages[-1].get("time", ""))[:10]
        if not last_active:
            last_active = clean_text(row.get("time"))

        node_type = "group" if row.get("is_group") else "person"
        tags = [features["relation_label"]]
        if features["value_score"] >= 70:
            tags.append("高价值")
        if features["wetness"] >= 65:
            tags.append("湿关系")
        if features["business_value"] >= 65:
            tags.append("商业相关")

        summary = build_summary(row, features, msg_count)
        nodes.append(
            {
                "id": username,
                "label": chat,
                "alias": chat,
                "type": node_type,
                "category": features["relation"],
                "relation_type": features["relation"],
                "value_score": features["value_score"],
                "wetness": features["wetness"],
                "intimacy": features["intimacy"],
                "business_value": features["business_value"],
                "message_count": msg_count,
                "last_active": last_active,
                "tags": tags,
                "confidence": features["confidence"],
                "summary": summary,
                "chat_type": row.get("chat_type", ""),
                "source": "wx-cli export sample",
            }
        )
        edges.append(
            {
                "source": "me",
                "target": username,
                "relation": features["relation"],
                "relation_label": features["relation_label"],
                "strength": features["strength"],
                "wetness": features["wetness"],
                "value_score": features["value_score"],
                "business_value": features["business_value"],
                "message_count": msg_count,
                "keywords": features["keywords"],
                "confidence": features["confidence"],
            }
        )

    graph = {
        "version": "0.1",
        "generated_at": "2026-06-03",
        "notes": [
            "公众号、服务号、折叠会话、文件传输助手已剔除。",
            "关系类型、湿度、价值分为启发式结果，不代表事实断言。",
            "前端建议把 confidence 低于 0.6 的关系显示为虚线或半透明。",
        ],
        "me": {"id": "me", "label": "我"},
        "nodes": nodes,
        "edges": edges,
    }

    (MATERIALS / "relationship-graph.json").write_text(
        json.dumps(graph, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    node_fields = [
        "id", "label", "type", "category", "value_score", "wetness", "intimacy",
        "business_value", "message_count", "last_active", "confidence", "summary",
    ]
    with (MATERIALS / "nodes.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=node_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(nodes)

    edge_fields = [
        "source", "target", "relation", "relation_label", "strength", "wetness",
        "value_score", "business_value", "message_count", "confidence",
    ]
    with (MATERIALS / "edges.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=edge_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(edges)

    brief = f"""# Gemini 前端材料说明

请使用 `relationship-graph.json` 作为唯一数据源，制作一个微信好友关系图谱前端。

## 数据规模

- 节点数：{len(nodes)}
- 关系边：{len(edges)}
- 已剔除公众号、服务号、折叠会话、文件传输助手等。

## 字段解释

- `relation_type/category`：关系类型，如 business、customer、supplier、family、brother、romance、group、business_group、weak。
- `wetness`：湿关系分，越高表示情绪/私交/生活内容越多。
- `business_value`：商业价值分。
- `value_score`：综合价值分。
- `strength`：关系强度，主要由消息量和样本密度估算。
- `confidence`：分类置信度，低于 0.6 建议用虚线或淡色展示。

## 视觉建议

- business/customer/supplier 用绿色、青色、橙色链路。
- brother 用蓝色链路。
- romance 用红色链路，但低置信度必须显示为“疑似”。
- family 用金色链路。
- weak 用灰色链路。
- 高 `value_score` 节点更大；高 `wetness` 节点有柔光；高 `business_value` 节点有绿色外环。

## 重要原则

这是启发式玩具，不是事实判定。前端文案避免断言，可显示“疑似/倾向于/样本判断”。
"""
    (MATERIALS / "README-for-gemini.md").write_text(brief, encoding="utf-8")

    print(f"materials written to {MATERIALS}")
    print(f"nodes={len(nodes)} edges={len(edges)}")


if __name__ == "__main__":
    main()
