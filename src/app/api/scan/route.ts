import { NextResponse } from "next/server";
import { parseScanResult, isScanResultUsable, type ScanResult } from "@/lib/receipt";

/* ── Model configuration (verified via ListModels 2026-10-24) ── */
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-3.1-flash-lite-preview";

/* ── Rate limiting ───────────────────────────────────────────── */
const WINDOW_MS = 60_000;
const MAX_HITS = 10;
const MAX_BASE64 = 4_000_000; // ~3 MB image data
const hits = new Map<string, number[]>();

/* ── Prompt ──────────────────────────────────────────────────── */
const PROMPT = `You are a receipt/payment screenshot reader. Extract these fields from the image.
Return ONLY a JSON object with exactly these fields:
- amount: integer in IDR (e.g. 48000, not "48.000")
- type: "expense" or "income"
- date: "YYYY-MM-DD"
- time: "HH:mm" (24h)
- purpose: merchant or recipient name (exact text from receipt)
- sourceWallet: payment app or bank name (e.g. "ShopeePay", "BCA", "DANA", "GoPay")
- reference: transaction reference number if visible, otherwise ""

If a field is not readable, use "" for strings and 0 for amount.
Do NOT invent data. Return only the JSON object, no markdown fences.`;

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    /* Rate limiting */
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_HITS) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }
    recent.push(now);
    hits.set(ip, recent);

    /* Parse image from request */
    let imageData: string | undefined;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (file && file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        imageData = base64;
      }
    } else if (contentType.includes("application/json")) {
      const { image } = await req.json();
      if (typeof image === "string" && image) {
        imageData = image.split(",")[1] || image;
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    if (imageData.length > MAX_BASE64) {
      return NextResponse.json({ error: "Image is too large. Please use a smaller image." }, { status: 413 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    /* Build Gemini request */
    const requestBody = JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: imageData } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    /* Call Gemini with timeout + fallback */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    let res: Response;
    try {
      const urlPrimary = `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${key}`;
      res = await fetch(urlPrimary, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      // Fallback on 404 (model not found)
      if (res.status === 404) {
        const urlFallback = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${key}`;
        res = await fetch(urlFallback, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
      }
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") {
        return NextResponse.json({ error: "Scan timed out. Please try again." }, { status: 504 });
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    /* Handle Gemini errors */
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || `Service error (${res.status})`;
      // Don't leak internal details
      const userMsg = res.status === 429
        ? "AI service is busy. Please try again in a moment."
        : res.status === 401 || res.status === 403
          ? "Server configuration error."
          : `Could not read receipt. ${res.status >= 500 ? "Please try again." : ""}`;
      console.error("[scan] Gemini error", res.status, msg.slice(0, 200));
      return NextResponse.json({ error: userMsg }, { status: res.status >= 500 ? 502 : res.status });
    }

    /* Parse response */
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanText = text.replace(/```json|```/g, "").trim();
    let jsonStr = cleanText;
    if (!jsonStr.trim().startsWith("{")) {
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0];
    }

    let resultObj: unknown = {};
    try {
      resultObj = JSON.parse(jsonStr);
    } catch {
      console.error("[scan] JSON parse error for response");
      resultObj = {};
    }

    const result: ScanResult = parseScanResult(resultObj);

    /* Log timing (dev only) */
    if (process.env.NODE_ENV === "development") {
      console.log(`[scan] completed in ${Date.now() - startTime}ms, usable=${isScanResultUsable(result)}`);
    }

    return NextResponse.json(result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[scan] route error", err.message);
    return NextResponse.json(
      { error: "We couldn't read this receipt. Please try again or fill it in manually." },
      { status: 500 }
    );
  }
}
