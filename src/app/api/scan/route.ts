import { NextResponse } from "next/server";

const MODEL = "gemini-3.8-flash";
const WINDOW_MS = 60_000;
const MAX_HITS = 10;
const MAX_BASE64 = 3_000_000;

const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_HITS) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    recent.push(now);
    hits.set(ip, recent);

    const { image } = await req.json();
    if (typeof image !== "string" || !image) {
      return NextResponse.json({ error: "No image" }, { status: 400 });
    }
    const base64Data = image.split(",")[1] || image;
    if (base64Data.length > MAX_BASE64) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Extract receipt info as valid JSON strictly format: {"amount": number, "isExpense": boolean, "date": "YYYY-MM-DD", "merchant": "string", "walletName": "string", "note": "string"}. No markdown, plain JSON only.',
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } },
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[scan] Gemini error", res.status, JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: data.error?.message || `Gemini error ${res.status}` },
        { status: res.status }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanText = text.replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(cleanText));
  } catch (e) {
    console.error("[scan] route error", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Failed to parse receipt" }, { status: 500 });
  }
}
