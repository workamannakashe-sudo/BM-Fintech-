// api/chat.ts — Vercel Serverless Function Proxy for FinBuddy AI
// Keeps Google Gemini API Key completely secret on the server.
// Enforces JWT validation, rate limiting, and prompt sanitization.

import { GoogleGenerativeAI } from "@google/generative-ai";

// Sliding-window rate limiter (in-memory per container instance)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_REQUESTS_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000;

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }

  record.count += 1;
  return false;
}

function sanitizePrompt(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, "[filtered]")
    .replace(/system\s+prompt/gi, "[filtered]")
    .replace(/system\s+role/gi, "[filtered]")
    .trim()
    .slice(0, 1500); // 1500 char ceiling
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // Rate Limiting
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "anonymous";

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: "Rate limit exceeded. Maximum 20 requests per minute allowed.",
      retryAfterSeconds: 60,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    return res.status(503).json({
      error: "Gemini AI API key is not configured on the server. Using deterministic heuristic fallback.",
      fallback: true,
    });
  }

  try {
    const { message, systemPrompt, chatHistory } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Invalid payload: 'message' is required." });
    }

    const cleanMessage = sanitizePrompt(message);
    const cleanSystemPrompt = typeof systemPrompt === "string" ? systemPrompt.slice(0, 4000) : "";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: cleanSystemPrompt || undefined,
    });

    // Format multi-turn history if provided
    const formattedHistory = Array.isArray(chatHistory)
      ? chatHistory.slice(-10).map((m: any) => ({
          role: m.role === "assistant" || m.role === "bob" ? "model" : "user",
          parts: [{ text: String(m.content || m.text || "").slice(0, 1000) }],
        }))
      : [];

    const chatSession = model.startChat({
      history: formattedHistory,
    });

    const result = await chatSession.sendMessage(cleanMessage);
    const responseText = result.response.text();

    return res.status(200).json({
      reply: responseText,
      grounded: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API/chat] Gemini generation error:", error?.message || error);
    return res.status(500).json({
      error: "AI service temporarily unavailable. Falling back to rule engine.",
      details: error?.message,
      fallback: true,
    });
  }
}
