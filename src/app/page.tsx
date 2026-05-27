"use client";

import { useState } from "react";

type ImportResult = {
  ok: boolean;
  property?: unknown;
  error?: string;
  warnings?: string[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function importProperty() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/import-property", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const json = await response.json();
      setResult(json);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1>House Tracker Importer</h1>

      <p>Paste a realestate.com.au property link.</p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.realestate.com.au/property-house-qld-..."
          style={{ flex: 1, padding: 12 }}
        />

        <button
          onClick={importProperty}
          disabled={loading || !url}
          style={{ padding: "12px 16px" }}
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </div>

      {result && (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            background: "#111",
            color: "#eee",
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}