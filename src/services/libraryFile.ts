import type { CatechismDocument } from "../types.ts";

export const LIBRARY_FILE_KIND = "catechesis-library";
export const SEARCH_CONTENT_LIMIT = 15000;

export interface LibraryFile {
  kind: typeof LIBRARY_FILE_KIND;
  version: 1;
  exportedAt: string;
  documents: CatechismDocument[];
}

export function sortDocuments(documents: CatechismDocument[]): CatechismDocument[] {
  return [...documents].sort((a, b) => {
    if (Boolean(a.isPreset) !== Boolean(b.isPreset)) return a.isPreset ? 1 : -1;
    return (b.uploadedAt || "").localeCompare(a.uploadedAt || "");
  });
}

export function toSearchPayload(documents: CatechismDocument[]): Array<Omit<CatechismDocument, "imageUrl">> {
  return documents.map((doc) => {
    const { imageUrl: _imageUrl, ...rest } = doc;
    return {
      ...rest,
      content: (doc.content || "").slice(0, SEARCH_CONTENT_LIMIT),
    };
  });
}

export function createLibraryFile(documents: CatechismDocument[]): LibraryFile {
  return {
    kind: LIBRARY_FILE_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    documents,
  };
}

function asDocument(value: unknown, index: number): CatechismDocument | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CatechismDocument>;
  if (typeof raw.content !== "string" || !raw.content.trim()) return null;
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;
  const content = raw.content;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `import-${Date.now()}-${index}`,
    title: raw.title.trim(),
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "堂區講義與教案筆記",
    content,
    sourceMeta: typeof raw.sourceMeta === "string" ? raw.sourceMeta : "由文獻庫檔案匯入",
    uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : new Date().toISOString(),
    fileType: typeof raw.fileType === "string" ? raw.fileType : "text",
    wordCount: typeof raw.wordCount === "number" && Number.isFinite(raw.wordCount) ? raw.wordCount : content.length,
    isPreset: raw.isPreset === true,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : undefined,
  };
}

export function parseLibraryFile(raw: string): CatechismDocument[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("匯入檔不是有效的 JSON。");
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { documents?: unknown }).documents)
      ? (data as { documents: unknown[] }).documents
      : null;
  if (!list) throw new Error("匯入檔不是文獻庫格式。");
  const documents = list
    .map((item, index) => asDocument(item, index))
    .filter((item): item is CatechismDocument => item !== null);
  if (documents.length === 0) throw new Error("匯入檔裡沒有可讀的文獻。");
  return documents;
}

export function mergeLibrary(current: CatechismDocument[], incoming: CatechismDocument[]): CatechismDocument[] {
  const map = new Map(current.map((doc) => [doc.id, doc]));
  for (const doc of incoming) map.set(doc.id, doc);
  return sortDocuments([...map.values()]);
}

export function downloadLibraryFile(documents: CatechismDocument[]): void {
  const payload = createLibraryFile(documents);
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `教理文獻庫-${day}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
