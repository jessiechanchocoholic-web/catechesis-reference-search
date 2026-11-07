import type { CatechismDocument, ReadingListItem } from "../types";
import { PRESET_DOCUMENTS } from "../data/sampleCatechism";
import { mergeLibrary, sortDocuments } from "./libraryFile";

const DB_NAME = "catechesis-library";
const DB_VERSION = 1;
const DOC_STORE = "documents";
const LEGACY_DOCS_KEY = "catechesis_custom_documents_v1";
const STORAGE_KEY_READING_LIST = "catechesis_reading_list_v1";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("無法開啟本機文獻庫"));
    };
  });
  return databasePromise;
}

function storageError(error: unknown): Error {
  if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
    return new Error("瀏覽器儲存空間不足。請先匯出文獻庫，再刪除部分大書後重試。");
  }
  return error instanceof Error ? error : new Error("文獻庫讀寫失敗");
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, mode);
      const store = tx.objectStore(DOC_STORE);
      const request = run(store);
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(storageError(tx.error));
      tx.onabort = () => reject(storageError(tx.error));
    });
  } catch (error) {
    throw storageError(error);
  }
}

async function readAllDocuments(): Promise<CatechismDocument[]> {
  const docs = (await withStore<CatechismDocument[]>("readonly", (store) => store.getAll())) as CatechismDocument[];
  return sortDocuments(Array.isArray(docs) ? docs : []);
}

async function writeDocuments(docs: CatechismDocument[]): Promise<void> {
  await withStore("readwrite", (store) => {
    for (const doc of docs) store.put(doc);
  });
}

function readLegacyDocuments(): CatechismDocument[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_DOCS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as CatechismDocument[];
  } catch {
    return null;
  }
}

export async function loadDocuments(): Promise<CatechismDocument[]> {
  const existing = await readAllDocuments();
  if (existing.length > 0) return existing;

  const legacy = readLegacyDocuments();
  if (legacy) {
    await writeDocuments(legacy);
    localStorage.removeItem(LEGACY_DOCS_KEY);
    return sortDocuments(legacy);
  }

  await writeDocuments(PRESET_DOCUMENTS);
  return sortDocuments(PRESET_DOCUMENTS);
}

export async function saveDocument(doc: CatechismDocument): Promise<CatechismDocument[]> {
  await writeDocuments([doc]);
  return readAllDocuments();
}

export async function saveDocumentsBatch(docs: CatechismDocument[]): Promise<CatechismDocument[]> {
  if (!docs || docs.length === 0) return readAllDocuments();
  await writeDocuments(docs);
  return readAllDocuments();
}

export async function deleteDocument(id: string): Promise<CatechismDocument[]> {
  return deleteDocumentsBatch([id]);
}

export async function deleteDocumentsBatch(ids: string[]): Promise<CatechismDocument[]> {
  await withStore("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });
  return readAllDocuments();
}

export async function restorePresets(): Promise<CatechismDocument[]> {
  const current = await readAllDocuments();
  const ids = new Set(current.map((doc) => doc.id));
  const missing = PRESET_DOCUMENTS.filter((doc) => !ids.has(doc.id));
  if (missing.length > 0) await writeDocuments(missing);
  return readAllDocuments();
}

export async function importDocuments(incoming: CatechismDocument[]): Promise<CatechismDocument[]> {
  const current = await readAllDocuments();
  const merged = mergeLibrary(current, incoming);
  await withStore("readwrite", (store) => {
    store.clear();
    for (const doc of merged) store.put(doc);
  });
  return readAllDocuments();
}

export const getReadingList = (): ReadingListItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READING_LIST);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const addToReadingList = (item: Omit<ReadingListItem, "id" | "addedAt">): ReadingListItem[] => {
  const current = getReadingList();
  const exists = current.some((entry) => entry.sourceTitle === item.sourceTitle && entry.locator === item.locator);
  if (exists) return current;

  const newItem: ReadingListItem = {
    ...item,
    id: `read-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    addedAt: new Date().toISOString(),
  };
  const updated = [newItem, ...current];
  localStorage.setItem(STORAGE_KEY_READING_LIST, JSON.stringify(updated));
  return updated;
};

export const removeFromReadingList = (id: string): ReadingListItem[] => {
  const current = getReadingList();
  const updated = current.filter((entry) => entry.id !== id);
  localStorage.setItem(STORAGE_KEY_READING_LIST, JSON.stringify(updated));
  return updated;
};

export const clearReadingList = (): ReadingListItem[] => {
  localStorage.setItem(STORAGE_KEY_READING_LIST, JSON.stringify([]));
  return [];
};
