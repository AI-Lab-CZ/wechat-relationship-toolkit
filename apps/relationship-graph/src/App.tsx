import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import {
  Activity,
  Bot,
  Briefcase,
  CircleDollarSign,
  Filter,
  Heart,
  Info,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import RelationshipGraph from "./components/RelationshipGraph.js";
import { relationshipData, GraphNode } from "./data/graphData.js";

const categoryGroups = [
  { id: "all", label: "全部关系", dot: "bg-white" },
  { id: "business", label: "绿青/商圈", dot: "bg-emerald-400" },
  { id: "family", label: "金色/亲人", dot: "bg-amber-400" },
  { id: "brother", label: "蓝色/朋友", dot: "bg-blue-400" },
  { id: "group", label: "紫色/社群", dot: "bg-violet-400" },
  { id: "weak", label: "灰色/弱关系", dot: "bg-slate-400" },
];

function relationLabel(category: string) {
  const labels: Record<string, string> = {
    self: "中心节点",
    customer: "客户",
    supplier: "供应商",
    business: "生意伙伴",
    business_group: "业务群",
    family: "家人亲属",
    brother: "朋友兄弟",
    romance: "亲密关系",
    group: "群聊",
    weak: "普通/弱关系",
  };
  return labels[category] || category;
}

function categoryColor(category: string) {
  if (category === "family") return "text-amber-300 border-amber-400/30 bg-amber-400/10";
  if (category === "brother") return "text-blue-300 border-blue-400/30 bg-blue-400/10";
  if (category === "romance") return "text-rose-300 border-rose-400/30 bg-rose-400/10";
  if (["customer", "supplier", "business", "business_group"].includes(category)) {
    return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
  }
  if (["group"].includes(category)) return "text-violet-300 border-violet-400/30 bg-violet-400/10";
  return "text-slate-300 border-slate-500/30 bg-slate-500/10";
}

function matchesCategory(node: GraphNode, filterCategory: string) {
  if (filterCategory === "all" || node.id === "me") return true;
  if (filterCategory === "business") {
    return ["customer", "supplier", "business", "business_group"].includes(node.category);
  }
  if (filterCategory === "group") {
    return ["group", "business_group"].includes(node.category);
  }
  return node.category === filterCategory;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [hideLowConfidence, setHideLowConfidence] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("me");
  const [viewMode, setViewMode] = useState<"graph" | "cards">("graph");
  const [queryInput, setQueryInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "我会基于当前图谱做启发式分析。默认演示数据不会调用外部 API；如需 Gemini 分析，请在本地 `.env` 中显式开启。",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedNode = useMemo(() => {
    return relationshipData.nodes.find((node) => node.id === selectedNodeId) || relationshipData.nodes[0];
  }, [selectedNodeId]);

  const visibleNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return relationshipData.nodes
      .filter((node) => matchesCategory(node, filterCategory))
      .filter((node) => !hideLowConfidence || node.confidence >= 0.6 || node.id === "me")
      .filter((node) => {
        if (!query) return true;
        return `${node.label} ${node.alias} ${node.summary} ${node.tags.join(" ")}`
          .toLowerCase()
          .includes(query);
      });
  }, [filterCategory, hideLowConfidence, searchQuery]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return relationshipData.edges.filter((edge) => (
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target) &&
      (!hideLowConfidence || edge.confidence >= 0.6)
    ));
  }, [hideLowConfidence, visibleNodeIds]);

  const contactList = useMemo(() => {
    return visibleNodes
      .filter((node) => node.id !== "me")
      .sort((a, b) => b.value_score - a.value_score);
  }, [visibleNodes]);

  const stats = useMemo(() => {
    const contacts = relationshipData.nodes.filter((node) => node.id !== "me");
    const business = contacts.filter((node) => ["customer", "supplier", "business", "business_group"].includes(node.category)).length;
    const wet = Math.round(contacts.reduce((sum, node) => sum + node.wetness, 0) / contacts.length);
    const value = Math.round(contacts.reduce((sum, node) => sum + node.business_value, 0) / contacts.length);
    return {
      total: relationshipData.nodes.length,
      business,
      uncertain: contacts.filter((node) => node.confidence < 0.6).length,
      wet,
      value,
    };
  }, []);

  async function submitQuestion(question = queryInput) {
    const text = question.trim();
    if (!text || isLoading) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setQueryInput("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, category: filterCategory !== "all" ? filterCategory : undefined }),
      });
      const result = await response.json();
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.success
            ? result.text
            : `AI 分析当前不可用：${result.error || "请检查本地环境变量配置。"}`,
        },
      ]);
    } catch (error: any) {
      setMessages((current) => [...current, { role: "assistant", text: `请求失败：${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      <header className="border-b border-slate-800 bg-[#090e1a]/95 px-5 py-4">
        <div className="mx-auto flex max-w-[1720px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/25">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">微信社交关系智能图谱</h1>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                  Heuristic v0.1
                </span>
              </div>
              <p className="text-sm text-slate-400">本地优先的关系图谱、价值标记和启发式洞察工具</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <StatPill label="成员总数" value={stats.total} />
            <StatPill label="商圈集群" value={stats.business} tone="emerald" />
            <StatPill label="疑似关系" value={stats.uncertain} tone="rose" />
            <StatPill label="平均湿度" value={`${stats.wet}%`} tone="sky" />
          </div>
        </div>
      </header>

      <div className="border-b border-rose-950/40 bg-slate-950/70 px-5 py-2 text-center text-xs text-rose-300">
        <Info className="mr-1 inline h-3.5 w-3.5" />
        这是基于消息频率、关键词和样本摘要的启发式模型，分类和评分只作关系热度参考，不代表事实判断。
      </div>

      <main className="mx-auto grid max-w-[1720px] grid-cols-1 gap-5 p-5 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/45">
            <div className="space-y-4 border-b border-slate-800 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索微信好友/总结关键词..."
                  className="h-10 w-full rounded-md border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  关系类型聚类
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categoryGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setFilterCategory(group.id)}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition ${
                        filterCategory === group.id
                          ? "border-indigo-500 bg-indigo-500/15 text-white"
                          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${group.dot}`} />
                        {group.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  过滤低置信度关系
                </span>
                <input
                  type="checkbox"
                  checked={hideLowConfidence}
                  onChange={() => setHideLowConfidence((value) => !value)}
                  className="h-4 w-4 accent-indigo-500"
                />
              </label>
            </div>

            <div className="max-h-[610px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-500">
                <span>联系人目录</span>
                <span>{contactList.length} 位</span>
              </div>
              {contactList.map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`block w-full border-b border-slate-800 px-4 py-3 text-left transition ${
                    selectedNodeId === node.id ? "bg-indigo-500/10" : "hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-100">{node.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{node.summary}</p>
                    </div>
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
                      VAL {node.value_score}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span className={node.confidence < 0.6 ? "text-rose-300" : "text-emerald-300"}>
                      {relationLabel(node.category)}
                    </span>
                    <span>{node.last_active || "长期稳定"}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-3">
            <div className="flex rounded-md border border-slate-800 bg-slate-900 p-1 text-xs">
              <button
                onClick={() => setViewMode("graph")}
                className={`rounded px-3 py-1.5 ${viewMode === "graph" ? "bg-indigo-500 text-white" : "text-slate-400"}`}
              >
                星图视图
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`rounded px-3 py-1.5 ${viewMode === "cards" ? "bg-indigo-500 text-white" : "text-slate-400"}`}
              >
                卡片视图
              </button>
            </div>
            <div className="text-xs text-slate-500">
              当前显示 {visibleNodes.length} 个节点、{visibleEdges.length} 条关系
            </div>
          </div>

          {viewMode === "graph" ? (
            <RelationshipGraph
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={(node) => setSelectedNodeId(node.id)}
            />
          ) : (
            <CardGrid nodes={contactList} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Metric icon={Heart} label="平均社交湿度" value={`${stats.wet}%`} tone="text-sky-300" />
            <Metric icon={CircleDollarSign} label="平均商业权重" value={`${stats.value}%`} tone="text-emerald-300" />
            <Metric icon={Activity} label="关系分类置信度" value="启发式" tone="text-indigo-300" />
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-3">
          <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-5">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-slate-700 bg-slate-900 text-xl font-bold">
                {selectedNode.label.slice(0, 2)}
              </div>
              <h2 className="mt-3 truncate text-lg font-bold">{selectedNode.label}</h2>
              <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{selectedNode.id}</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${categoryColor(selectedNode.category)}`}>
                {relationLabel(selectedNode.category)}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <ScoreBar label="情绪湿度" value={selectedNode.wetness} color="bg-sky-400" />
              <ScoreBar label="商业价值" value={selectedNode.business_value} color="bg-emerald-400" />
              <ScoreBar label="综合活跃度" value={selectedNode.value_score} color="bg-indigo-400" />
            </div>

            <div className="mt-5 rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm leading-6 text-slate-300">
              {selectedNode.summary}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <InfoBox label="消息数" value={`${selectedNode.message_count}`} />
              <InfoBox label="置信度" value={`${Math.round(selectedNode.confidence * 100)}%`} />
              <InfoBox label="最近活跃" value={selectedNode.last_active || "长期稳定"} />
              <InfoBox label="类型" value={selectedNode.type} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-950/45">
            <div className="flex items-center gap-2 border-b border-slate-800 p-4 font-semibold">
              <Bot className="h-4 w-4 text-indigo-300" />
              AI 图谱分析助手
            </div>
            <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-8 border-indigo-500/30 bg-indigo-500/10"
                      : "mr-8 border-slate-800 bg-slate-900/60"
                  }`}
                >
                  <Markdown>{message.text}</Markdown>
                </div>
              ))}
              {isLoading && <div className="text-xs text-slate-500">正在生成分析...</div>}
            </div>
            <form
              className="flex gap-2 border-t border-slate-800 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitQuestion();
              }}
            >
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="例如：谁更像核心客户？"
                className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading || !queryInput.trim()}
                className="grid h-10 w-10 place-items-center rounded-md bg-indigo-500 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </aside>
      </main>
    </div>
  );
}

function StatPill({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: string }) {
  const color = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : tone === "sky" ? "text-sky-300" : "text-slate-100";
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <span className="text-slate-500">{label}: </span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <Icon className={`h-4 w-4 ${tone}`} />
      <div className="mt-3 text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function CardGrid({ nodes, selectedNodeId, onSelectNode }: { nodes: GraphNode[]; selectedNodeId: string; onSelectNode: (id: string) => void }) {
  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/45 p-4 md:grid-cols-2">
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => onSelectNode(node.id)}
          className={`rounded-lg border p-4 text-left transition ${
            selectedNodeId === node.id ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{node.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{relationLabel(node.category)}</p>
            </div>
            <Sparkles className="h-4 w-4 text-indigo-300" />
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{node.summary}</p>
          <div className="mt-4 flex gap-2 text-[10px] text-slate-500">
            <span>VAL {node.value_score}</span>
            <span>WET {node.wetness}</span>
            <span>BIZ {node.business_value}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
