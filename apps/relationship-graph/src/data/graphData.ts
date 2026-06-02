import demoGraph from "../../../../examples/demo-data/relationship-graph.demo.json";

export interface GraphNode {
  id: string;
  label: string;
  alias: string;
  type: "person" | "group" | "self";
  category: string;
  relation_type: string;
  value_score: number;
  wetness: number;
  intimacy: number;
  business_value: number;
  message_count: number;
  last_active: string;
  tags: string[];
  confidence: number;
  summary: string;
  chat_type: "private" | "group" | "self" | string;
  source: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  relation_label: string;
  strength: number;
  wetness: number;
  value_score: number;
  business_value: number;
  message_count: number;
  keywords: string[];
  confidence: number;
}

export interface RelationshipData {
  version?: string;
  generated_at?: string;
  notes?: string[];
  me: { id: string; label: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const relationshipData = demoGraph as RelationshipData;

export default relationshipData;
