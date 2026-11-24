// api/receipt.ts - Vercel Serverless Function for AI Vision Receipt Parsing
// CODEFESTTHON 2026 - AI/ML Track Feature B
import type { IncomingMessage, ServerResponse } from "node:http";

interface ReceiptParseResult {
  merchant: string;
  date: string;
  total: number;
  category: string;
  lineItems: Array<{ name: string; price: number }>;
  confidence: number;
  rawNotes?: string;
}

// In-memory rate limiting map for /api/receipt (15 requests/minute per IP)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 15;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");

  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(clientIp)) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: "Rate limit reached (15 receipt scans/min). Please try again shortly." }));
    return;
  }

  try {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
      if (rawBody.length > 5 * 1024 * 1024) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: "Payload too large. Please upload an image under 4MB." }));
        return;
      }
    }

    const { imageBase64, mimeType = "image/jpeg" } = JSON.parse(rawBody || "{}");
    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid request: missing imageBase64 string." }));
      return;
    }

    // Clean base64 data url prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Deterministic fallback response if server has not configured API key
      const fallbackResult: ReceiptParseResult = {
        merchant: "College Canteen / Store",
        date: new Date().toISOString().split("T")[0],
        total: 120.0,
        category: "Food & Dining",
        lineItems: [
          { name: "Snacks & Chai Combo", price: 80.0 },
          { name: "Water / Soft Drink", price: 40.0 },
        ],
        confidence: 0.65,
        rawNotes: "Demo mode: Set GEMINI_API_KEY in server environment for live OCR extraction.",
      };
      res.statusCode = 200;
      res.end(JSON.stringify(fallbackResult));
      return;
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const prompt = `Analyze this physical purchase receipt or bill.
Extract the merchant name, date of transaction, final total amount paid, suggested category, and individual line items.
Valid categories strictly one of:
["Food & Dining", "Academic & Books", "Housing & Rent", "Transport", "Entertainment", "Healthcare", "Personal & Shopping", "Utilities & Bills", "Other"]

Output strictly valid JSON matching this schema:
{
  "merchant": string,
  "date": "YYYY-MM-DD",
  "total": number,
  "category": string,
  "lineItems": [{"name": string, "price": number}],
  "confidence": number
}`;

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType,
      },
    };

    const aiResponse = await model.generateContent([prompt, imagePart]);
    const responseText = aiResponse.response.text();
    const parsedData = JSON.parse(responseText);

    const safeResult: ReceiptParseResult = {
      merchant: parsedData.merchant || "Store Purchase",
      date: parsedData.date || new Date().toISOString().split("T")[0],
      total: Number(parsedData.total) || 0,
      category: parsedData.category || "Food & Dining",
      lineItems: Array.isArray(parsedData.lineItems) ? parsedData.lineItems : [],
      confidence: Number(parsedData.confidence) || 0.85,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(safeResult));
  } catch (error: any) {
    console.error("Receipt API OCR Error:", error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Failed to parse receipt image via AI Vision.", details: error.message }));
  }
}
