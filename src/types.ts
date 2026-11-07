export interface CatechismDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  sourceMeta?: string;
  uploadedAt: string;
  fileType?: string;
  wordCount: number;
  isPreset?: boolean;
  imageUrl?: string;
}

export interface CustomCitation {
  documentId: string;
  documentTitle: string;
  exactQuote: string;
  sectionLocator: string;
  contextSnippet: string;
  relevanceSummary: string;
  catecheticalTheme: string;
}

export interface CustomSearchResponse {
  sourceType: "custom";
  query: string;
  summary: string;
  citations: CustomCitation[];
  totalMatches: number;
  timestamp: string;
}

export interface WebSource {
  uri: string;
  title: string;
}

export interface WebSearchResponse {
  sourceType: "web";
  query: string;
  librarianReport: string;
  sources: WebSource[];
  timestamp: string;
}

export type SearchScheme = "dual" | "custom" | "web";

export interface ReadingListItem {
  id: string;
  sourceType: "custom" | "web";
  sourceTitle: string;
  locator: string;
  quoteOrSnippet: string;
  context?: string;
  addedAt: string;
  url?: string;
}
