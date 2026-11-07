import { CatechismDocument, ReadingListItem } from "../types";
import { PRESET_DOCUMENTS } from "../data/sampleCatechism";

const STORAGE_KEY_DOCS = "catechesis_custom_documents_v1";
const STORAGE_KEY_READING_LIST = "catechesis_reading_list_v1";

export const getStoredDocuments = (): CatechismDocument[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (!raw) {
      // First time initialization: seed with preset documents
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(PRESET_DOCUMENTS));
      return PRESET_DOCUMENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return PRESET_DOCUMENTS;
  } catch (e) {
    console.error("Error reading stored documents", e);
    return PRESET_DOCUMENTS;
  }
};

export const saveDocument = (doc: CatechismDocument): CatechismDocument[] => {
  return saveDocumentsBatch([doc]);
};

export const saveDocumentsBatch = (docs: CatechismDocument[]): CatechismDocument[] => {
  if (!docs || docs.length === 0) return getStoredDocuments();
  const current = getStoredDocuments();
  const incomingMap = new Map(docs.map((d) => [d.id, d]));
  
  // Exclude existing documents with matching id that are being replaced
  const preserved = current.filter((d) => !incomingMap.has(d.id));
  
  // Place newly added/updated documents at the top
  const updated = [...docs, ...preserved];
  localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(updated));
  return updated;
};

export const deleteDocument = (id: string): CatechismDocument[] => {
  return deleteDocumentsBatch([id]);
};

export const deleteDocumentsBatch = (ids: string[]): CatechismDocument[] => {
  const current = getStoredDocuments();
  const idSet = new Set(ids);
  const updated = current.filter((d) => !idSet.has(d.id));
  localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(updated));
  return updated;
};

export const resetToPresets = (): CatechismDocument[] => {
  localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(PRESET_DOCUMENTS));
  return PRESET_DOCUMENTS;
};

// Reading List storage
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
  // Check if duplicate quote/locator
  const exists = current.some(
    (i) => i.sourceTitle === item.sourceTitle && i.locator === item.locator
  );
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
  const updated = current.filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY_READING_LIST, JSON.stringify(updated));
  return updated;
};

export const clearReadingList = (): ReadingListItem[] => {
  localStorage.setItem(STORAGE_KEY_READING_LIST, JSON.stringify([]));
  return [];
};
