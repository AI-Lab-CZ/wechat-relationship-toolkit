import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { relationshipData } from "./src/data/graphData.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS === "true";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

app.get("/api/graph", (_req, res) => {
  res.json({
    success: true,
    data: relationshipData,
  });
});

app.post("/api/analyze", async (req, res) => {
  const { query, category } = req.body;
  if (!query) {
    res.status(400).json({ success: false, error: "Query is required." });
    return;
  }
  if (!ENABLE_AI_ANALYSIS) {
    res.status(403).json({
      success: false,
      error: "AI analysis is disabled. Set ENABLE_AI_ANALYSIS=true and GEMINI_API_KEY in your local .env file to enable it.",
    });
    return;
  }

  try {
    const ai = getGeminiClient();
    const nodesSummary = relationshipData.nodes.map((n) => {
      return [
        `Name: ${n.label}`,
        `Category: ${n.category}`,
        `Value: ${n.value_score}/100`,
        `Wetness: ${n.wetness}/100`,
        `Business: ${n.business_value}/100`,
        `Messages: ${n.message_count}`,
        `Last Active: ${n.last_active || "N/A"}`,
        `Summary: ${n.summary}`,
      ].join(", ");
    }).join("\n");

    const edgesSummary = relationshipData.edges.slice(0, 50).map((e) => {
      return [
        `From: ${e.source}`,
        `To: ${e.target}`,
        `Type: ${e.relation}`,
        `Strength: ${e.strength}`,
        `Messages: ${e.message_count}`,
        `Keywords: ${e.keywords.join("/")}`,
      ].join(", ");
    }).join("\n");

    const systemPrompt = `You are a WeChat relationship graph analyst.
You are given a local relationship graph summary (${relationshipData.nodes.length} nodes, ${relationshipData.edges.length} edges).

Nodes:
${nodesSummary}

Edges:
${edgesSummary}

Rules:
1. This is a heuristic toy model, not a factual judgment.
2. Always use soft wording such as "疑似", "倾向于", "算法推测", and "样本倾向".
3. Do not make moral, legal, medical, or financial judgments about people.
4. Answer in clear, structured Standard Chinese.
5. Remind the user that the result comes from local graph statistics, not raw truth.`;

    const userPrompt = category
      ? `[Category context: ${category}] User question: ${query}`
      : query;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to communicate with Gemini.",
    });
  }
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

setupVite();
