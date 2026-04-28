"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export function OCRScanner({
  onParsedText,
}: {
  onParsedText: (text: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const onFileChange = (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      setError("Unsupported file type. Please upload JPG, PNG, HEIC, or PDF.");
      setFile(null);
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setError("File too large. Maximum size is 10MB.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(nextFile);
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      const base64 = btoa(binary);
      const payload = `data:${file.type};base64,${base64}`;
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setText(body.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan receipt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block rounded-xl border border-dashed border-wm-border bg-wm-s2 p-6 text-center text-sm text-wm-text2">
        Drag and drop or click to choose receipt image/PDF
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.heic,.pdf,image/*,application/pdf"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-xs text-wm-text3"
        />
      </label>

      {previewUrl && (
        <div className="rounded-md border border-wm-border bg-wm-s1 p-2">
          <Image
            src={previewUrl}
            alt="Receipt preview"
            width={800}
            height={400}
            unoptimized
            className="max-h-64 w-full rounded object-contain"
          />
        </div>
      )}

      <button
        type="button"
        onClick={scan}
        disabled={!file || loading}
        className="rounded-md bg-wm-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Scanning receipt..." : "Scan Receipt"}
      </button>

      {error && (
        <p className="rounded-md border border-wm-red/40 bg-wm-red/10 px-3 py-2 text-sm text-wm-red">
          {error}
        </p>
      )}

      {text && (
        <div className="space-y-3">
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-wm-border bg-wm-s2 px-3 py-2 text-sm text-wm-text"
          />
          <button
            type="button"
            onClick={() => onParsedText(text)}
            className="rounded-md bg-wm-purple px-4 py-2 text-sm font-medium text-white"
          >
            Parse with AI →
          </button>
        </div>
      )}
    </div>
  );
}
