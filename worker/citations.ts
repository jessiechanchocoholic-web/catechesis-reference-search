export interface WebSource {
  uri: string;
  title: string;
}

const URL_KEYS = new Set(["url", "uri", "link", "href"]);
const TITLE_KEYS = new Set(["title", "name", "document_title", "documentTitle"]);

function cleanUrl(value: string): string | null {
  const cleaned = value.trim().replace(/[),.;\]>'"]+$/g, "");
  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (/api\.poe\.com|localhost|127\.0\.0\.1/i.test(cleaned)) return null;
  return cleaned;
}

function pushSource(
  sources: WebSource[],
  seen: Set<string>,
  uri: unknown,
  title?: unknown,
) {
  if (typeof uri !== "string") return;
  const cleaned = cleanUrl(uri);
  if (!cleaned) return;
  const key = cleaned.replace(/\/+$/, "");
  if (seen.has(key)) return;
  seen.add(key);
  const label = typeof title === "string" && title.trim() ? title.trim() : cleaned;
  sources.push({ uri: cleaned, title: label.slice(0, 180) });
}

function walk(node: unknown, sources: WebSource[], seen: Set<string>, depth: number) {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, sources, seen, depth + 1);
    return;
  }
  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  let uri: unknown;
  let title: unknown;
  for (const [key, value] of Object.entries(record)) {
    if (URL_KEYS.has(key) && typeof value === "string") uri = value;
    if (TITLE_KEYS.has(key) && typeof value === "string") title = value;
  }
  if (typeof uri === "string") pushSource(sources, seen, uri, title);

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") walk(value, sources, seen, depth + 1);
  }
}

export function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("模型未回傳可解析的 JSON");
  }
}

export function chatText(data: unknown): string {
  const choice = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function responsesText(data: unknown): string {
  const record = data as { output_text?: unknown; output?: unknown };
  if (typeof record?.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }
  const chunks: string[] = [];
  if (Array.isArray(record?.output)) {
    for (const item of record.output) {
      const content = (item as { content?: unknown })?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block && typeof block === "object" && "text" in block && typeof block.text === "string") {
          chunks.push(block.text);
        }
      }
    }
  }
  return chunks.join("\n").trim();
}

export function splitReportAndSources(text: string, raw?: unknown): { report: string; sources: WebSource[] } {
  let report = text.trim();
  const embedded: unknown[] = [];
  const marker = report.match(/CITATIONS_JSON:\s*(\[[\s\S]*?\])/);
  if (marker) {
    try {
      const parsed = JSON.parse(marker[1]);
      if (Array.isArray(parsed)) embedded.push(...parsed);
    } catch {
      // The prose report is still usable when the trailing list is not valid JSON.
    }
    report = report.replace(marker[0], "").replace(/```json|```/g, "").trim();
  }

  const sources: WebSource[] = [];
  const seen = new Set<string>();
  walk(embedded, sources, seen, 0);
  walk(raw, sources, seen, 0);

  const markdown = /\[([^\]\n]{1,180})\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of report.matchAll(markdown)) {
    pushSource(sources, seen, match[2], match[1]);
  }

  const bare = /https?:\/\/[^\s)\]>"']+/g;
  for (const match of report.matchAll(bare)) {
    pushSource(sources, seen, match[0]);
  }

  return { report, sources: sources.slice(0, 12) };
}
