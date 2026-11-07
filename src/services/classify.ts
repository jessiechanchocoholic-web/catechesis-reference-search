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
