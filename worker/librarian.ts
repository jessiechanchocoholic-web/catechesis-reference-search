export interface LibraryDocument {
  id: string;
  title: string;
  category?: string;
  content?: string;
  sourceMeta?: string;
}

export const SIGAO_RULE =
  "聖經引文必須沿用天主教《思高聖經》用字與譯名（天主、聖神、恩寵、福音、瑪竇、馬爾谷、路加、若望、宗徒、保祿、伯多祿、格林多、羅馬書、撒瑪黎雅、達瑪）。不可改寫成基督教和合本用字（上帝、聖靈、馬太、約翰福音、馬可等）。";

export function classifyDocumentContent(title: string, content: string): string {
  const text = (title + " " + content.slice(0, 3000)).toLowerCase();
  if (/信德|信條|天主|創世|三位一體|復活|救恩|降生成人|原罪/.test(text)) return "信德信條";
  if (/聖事|感恩|聖體|洗禮|聖洗|堅振|告解|和好|婚配|聖秩|傅油|禮儀|彌撒|實質轉變/.test(text)) return "禮儀聖事";
  if (/倫理|十誡|誡命|真福|愛德|道德|社會訓導|良心|罪過/.test(text)) return "基督徒倫理";
  if (/祈禱|天主經|主禱文|默想|默觀|念珠|玫瑰經|日課|達瑪森/.test(text)) return "基督徒祈禱";
  if (/聖經|福音|新約|舊約|宗徒|瑪竇|馬爾谷|路加|若望|格林多|羅馬書|伯多祿|保祿|撒瑪黎雅/.test(text)) return "聖經經文與註釋";
  if (/通諭|大公會議|梵二|憲章|宗座|訓導|法典|教會憲章/.test(text)) return "教會訓導文獻";
  return "堂區講義與教案筆記";
}

export function lexicalExtractCitations(query: string, documents: LibraryDocument[]) {
  const keywords = query
    .toLowerCase()
    .split(/[\s,，、。！？；;「」『』()]+/)
    .filter((keyword) => keyword.length >= 2);

  if (keywords.length === 0) return [];

  const matchedItems: Array<{
    doc: LibraryDocument;
    quote: string;
    locator: string;
    context: string;
    score: number;
    matchedWords: string[];
  }> = [];

  for (const doc of documents) {
    if (!doc.content) continue;
    const rawParagraphs = doc.content.split(/\n\s*\n/);
    const paragraphs = rawParagraphs.length > 1 ? rawParagraphs : doc.content.split("\n");
    let currentSection = doc.title || "教理文獻選段";

    for (const paragraphRaw of paragraphs) {
      const paragraph = paragraphRaw.trim();
      if (!paragraph) continue;

      const headerMatch = paragraph.match(
        /(第[0-9一二三四五六七八九十百千]+[條章節篇]|【[^】]+】|CCC\s*[0-9]+|[0-9]+:[0-9]+(-[0-9]+)?)/i,
      );
      if (headerMatch) currentSection = headerMatch[0];

      const matchedWords: string[] = [];
      let score = 0;
      for (const keyword of keywords) {
        if (paragraph.toLowerCase().includes(keyword)) {
          matchedWords.push(keyword);
          score += 1;
        }
      }
      if (score === 0) continue;

      const sentences = paragraph.split(/(?<=[。！？\n])/);
      const bestSentence =
        sentences.find((sentence) => matchedWords.some((keyword) => sentence.toLowerCase().includes(keyword))) ||
        sentences[0];

      matchedItems.push({
        doc,
        quote: bestSentence.trim().slice(0, 250),
        locator: currentSection,
        context: paragraph.slice(0, 300),
        score,
        matchedWords,
      });
    }
  }

  matchedItems.sort((a, b) => b.score - a.score);
  return matchedItems.slice(0, 6).map((item) => ({
    documentId: item.doc.id,
    documentTitle: item.doc.title,
    exactQuote: item.quote,
    sectionLocator: item.locator,
    contextSnippet: item.context,
    relevanceSummary: `館員依關鍵字「${item.matchedWords.join("、")}」定位於此段落，與檢索內容高度相應。`,
    catecheticalTheme: item.doc.category || classifyDocumentContent(item.doc.title, item.context),
  }));
}
