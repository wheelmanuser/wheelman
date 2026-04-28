import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { recognize } from "tesseract.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_PREFIX = ["image/", "application/pdf"];

export async function POST(request: Request) {
  try {
    const { imageBase64 } = (await request.json()) as { imageBase64?: string };
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }

    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid base64 data URI" }, { status: 400 });
    }
    const mimeType = match[1] ?? "";
    const base64Data = match[2] ?? "";
    if (!ALLOWED_MIME_PREFIX.some((prefix) => mimeType.startsWith(prefix))) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, HEIC, or PDF." },
        { status: 400 },
      );
    }

    const approxBytes = Math.floor((base64Data.length * 3) / 4);
    if (approxBytes > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max upload size is 10MB." },
        { status: 413 },
      );
    }

    const { data } = await recognize(imageBase64, "eng");
    return NextResponse.json({ text: data.text ?? "" });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed" },
      { status: 500 },
    );
  }
}
