import React, { useState, useRef } from "react";
import { CatechismDocument } from "../types";
import {
  X,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileCode,
  CheckSquare,
  Square,
  Search,
  Layers,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: CatechismDocument[];
  onAddDocument: (doc: CatechismDocument) => void;
  onAddDocuments?: (docs: CatechismDocument[]) => void;
  onDeleteDocument: (id: string) => void;
  onBatchDeleteDocuments?: (ids: string[]) => void;
  onResetPresets: () => void;
  onPreviewDocument: (doc: CatechismDocument) => void;
}

interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "pending" | "processing" | "success" | "error";
  errorMessage?: string;
  resultDoc?: CatechismDocument;
}

const CATEGORIES = [
  "信德信條",
  "禮儀聖事",
  "基督徒倫理",
  "基督徒祈禱",
  "聖經經文與註釋",
  "教會訓導文獻",
  "堂區講義與教案筆記",
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({
  isOpen,
  onClose,
  documents,
  onAddDocument,
  onAddDocuments,
  onDeleteDocument,
  onBatchDeleteDocuments,
  onResetPresets,
  onPreviewDocument,
}) => {
  const [tab, setTab] = useState<"list" | "upload" | "paste">("upload");
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Document list management state
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Manual paste form state
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteCategory, setPasteCategory] = useState(CATEGORIES[0]);
  const [pasteContent, setPasteContent] = useState("");
  const [pasteSourceMeta, setPasteSourceMeta] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process a single file to produce a CatechismDocument
  const processSingleFile = async (file: File): Promise<CatechismDocument> => {
    const isImage =
      file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

    if (isImage) {
      // Read image as base64 and dataURL for preview
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("無法讀取圖片檔案"));
        reader.readAsDataURL(file);
      });

      const base64Data = dataUrl.split(",")[1] || "";
      const mimeType = file.type || "image/jpeg";

      const res = await fetch("/api/process-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: mimeType,
          base64Data,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "圖片文字與畫面解說解析失敗");
      }

      return {
        id: `custom-doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: data.title || file.name.replace(/\.[^/.]+$/, ""),
        category: data.category || "聖經經文與註釋",
        content: data.content || "",
        sourceMeta: `由主日福音插圖上載：${file.name}`,
        uploadedAt: new Date().toISOString(),
        fileType: "image",
        wordCount: data.wordCount || (data.content ? data.content.length : 0),
        imageUrl: dataUrl,
      };
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      // Read as base64 for backend PDF extraction
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("無法讀取 PDF 檔案"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/process-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: "application/pdf",
          base64Data: base64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "PDF 文字提取失敗");
      }

      return {
        id: `custom-doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: data.title || file.name.replace(/\.[^/.]+$/, ""),
        category: data.category || "自訂教理文獻",
        content: data.content || "",
        sourceMeta: `由 PDF 上載：${file.name}`,
        uploadedAt: new Date().toISOString(),
        fileType: "pdf",
        wordCount: data.wordCount || (data.content ? data.content.length : 0),
      };
    } else {
      // Read plain text / markdown / csv / json
      const rawText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("無法讀取文字檔案"));
        reader.readAsText(file);
      });

      if (!rawText.trim()) {
        throw new Error("檔案內容為空");
      }

      let docTitle = file.name.replace(/\.[^/.]+$/, "");
      let docCategory = "堂區講義與教案筆記";

      try {
        const res = await fetch("/api/process-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "text/plain",
            rawContent: rawText,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.title) docTitle = data.title;
          if (data.category) docCategory = data.category;
        }
      } catch {
        // Fallback gracefully without breaking
      }

      return {
        id: `custom-doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: docTitle,
        category: docCategory,
        content: rawText,
        sourceMeta: `由本機檔案批次上載：${file.name}`,
        uploadedAt: new Date().toISOString(),
        fileType: file.name.split(".").pop() || "txt",
        wordCount: rawText.length,
      };
    }
  };

  // Add files to queue and start batch processing
  const handleEnqueueFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setStatusMessage(null);

    const newItems: UploadQueueItem[] = rawFiles.map((f) => ({
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: "pending",
    }));

    // Merge into current queue
    const updatedQueue = [...queue, ...newItems];
    setQueue(updatedQueue);
    setIsProcessingBatch(true);

    const successfullyCreatedDocs: CatechismDocument[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each new file sequentially with individual status updates
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];

      // Mark current item as processing
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q))
      );

      try {
        const createdDoc = await processSingleFile(item.file);
        successfullyCreatedDocs.push(createdDoc);
        successCount++;

        // Add document to library immediately so user can see it right away
        onAddDocument(createdDoc);

        // Mark current item as success
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "success",
                  resultDoc: createdDoc,
                }
              : q
          )
        );
      } catch (err: any) {
        errorCount++;
        const errText = err?.message || "檔案解析失敗";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMessage: errText,
                }
              : q
          )
        );
      }
    }

    setIsProcessingBatch(false);

    if (errorCount === 0) {
      setStatusMessage({
        type: "success",
        text: `批次上載完成！共成功建立 ${successCount} 份文獻索引並存入資料庫。`,
      });
    } else {
      setStatusMessage({
        type: "info",
        text: `批次上載完成：${successCount} 份成功建立索引，${errorCount} 份處理失敗（可檢視下方個別提示）。`,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleEnqueueFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleEnqueueFiles(e.target.files);
    }
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueue([]);
    setStatusMessage(null);
  };

  // Manual paste submission
  const handleManualPasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTitle.trim() || !pasteContent.trim()) {
      setStatusMessage({ type: "error", text: "請輸入文獻標題與內容" });
      return;
    }

    const newDoc: CatechismDocument = {
      id: `custom-doc-${Date.now()}`,
      title: pasteTitle.trim(),
      category: pasteCategory,
      content: pasteContent.trim(),
      sourceMeta: pasteSourceMeta.trim() || "手動匯入教理講義",
      uploadedAt: new Date().toISOString(),
      fileType: "text",
      wordCount: pasteContent.trim().length,
    };

    onAddDocument(newDoc);
    setPasteTitle("");
    setPasteContent("");
    setPasteSourceMeta("");
    setStatusMessage({ type: "success", text: `已成功新增文獻：《${newDoc.title}》` });
    setTab("list");
  };

  // Batch delete handlers in document list
  const customDocs = documents.filter((d) => !d.isPreset);
  const filteredDocs = documents.filter((doc) => {
    if (!listSearchQuery.trim()) return true;
    const q = listSearchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.category.toLowerCase().includes(q) ||
      (doc.sourceMeta && doc.sourceMeta.toLowerCase().includes(q))
    );
  });

  const handleToggleSelectAllCustom = () => {
    if (selectedDocIds.size === customDocs.length && customDocs.length > 0) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(customDocs.map((d) => d.id)));
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecuteBatchDelete = () => {
    if (selectedDocIds.size === 0) return;
    const count = selectedDocIds.size;
    if (window.confirm(`確定要批次刪除選取的 ${count} 份自訂文獻嗎？此操作無法撤銷。`)) {
      if (onBatchDeleteDocuments) {
        onBatchDeleteDocuments(Array.from(selectedDocIds));
      } else {
        selectedDocIds.forEach((id) => onDeleteDocument(id));
      }
      setSelectedDocIds(new Set());
      setStatusMessage({ type: "success", text: `已成功批次移除 ${count} 份自訂文獻。` });
    }
  };

  // Queue statistics
  const successItems = queue.filter((q) => q.status === "success");
  const errorItems = queue.filter((q) => q.status === "error");
  const processingItems = queue.filter((q) => q.status === "processing");
  const pendingItems = queue.filter((q) => q.status === "pending");
  const totalCompleted = successItems.length + errorItems.length;
  const progressPercent = queue.length > 0 ? Math.round((totalCompleted / queue.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-700 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                自訂教理文獻資料庫管理
              </h2>
              <p className="text-xs text-stone-500">
                作為第一檢索根源 · 支援多檔案批量上傳、即時文字萃取與索引定位
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-stone-200 bg-white flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex space-x-1 py-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === "upload"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>批量檔案上傳</span>
              {queue.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-mono">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === "list"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>目前文獻庫 ({documents.length} 份)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("paste")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === "paste"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>手動貼上文獻</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onResetPresets}
            className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-amber-800 transition-colors shrink-0"
            title="恢復預設天主教教理與聖經核心文獻"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">恢復官方預載文獻</span>
          </button>
        </div>

        {/* Global Status Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-100"
                : statusMessage.type === "info"
                ? "bg-amber-50 text-amber-900 border-b border-amber-200"
                : "bg-red-50 text-red-800 border-b border-red-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusMessage.type === "info" ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: BATCH UPLOAD */}
          {tab === "upload" && (
            <div className="space-y-5">
              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDraggingOver
                    ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-400 ring-offset-2 scale-[0.99]"
                    : "border-stone-300 hover:border-amber-500 hover:bg-amber-50/20 bg-stone-50/40"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 transition-transform ${
                    isDraggingOver
                      ? "bg-amber-600 text-white scale-110"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-stone-900 font-serif">
                  點擊或拖曳檔案至此進行批量上載
                </h3>
                <p className="text-xs text-stone-600 mt-1.5 max-w-md mx-auto">
                  支援格式：<span className="font-semibold text-stone-800">.png, .jpg, .webp（主日福音插圖）、.pdf（簡報/講義）、.txt, .md, .json, .csv</span>
                </p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 text-amber-900 text-[11px] font-medium border border-amber-200/80">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span>聖經故事插圖動畫工作室福音圖：自動識別圖中文字解說、聖經章節標記與畫面情境</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.pdf,.json,.csv,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Batch Processing Queue & Status */}
              {queue.length > 0 && (
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  {/* Queue Control Header */}
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        批量上載佇列（共 {queue.length} 個檔案）
                      </span>
                      {isProcessingBatch && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                          <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                          <span>正在解析建立索引中...</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingBatch}
                        className="px-2.5 py-1 text-xs text-stone-700 hover:text-stone-900 hover:bg-stone-200/70 rounded border border-stone-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        <span>再加入檔案</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearQueue}
                        disabled={isProcessingBatch}
                        className="px-2 py-1 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        清空佇列
                      </button>
                      {successItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTab("list")}
                          className="px-2.5 py-1 text-xs bg-stone-900 text-amber-100 hover:bg-stone-800 rounded font-medium flex items-center gap-1 shadow-2xs"
                        >
                          <span>查看文獻庫</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="px-4 py-2.5 bg-stone-50/50 border-b border-stone-100 text-xs">
                    <div className="flex justify-between items-center text-[11px] text-stone-600 mb-1 font-mono">
                      <span>進度：{totalCompleted} / {queue.length} 完成 ({progressPercent}%)</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-700">成功：{successItems.length}</span>
                        {errorItems.length > 0 && (
                          <span className="text-red-600">失敗：{errorItems.length}</span>
                        )}
                        {pendingItems.length + processingItems.length > 0 && (
                          <span className="text-stone-400">
                            排程中：{pendingItems.length + processingItems.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Queue Items List */}
                  <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto">
                    {queue.map((item, index) => {
                      const isPdf =
                        item.file.type === "application/pdf" ||
                        item.name.toLowerCase().endsWith(".pdf");
                      const isImage =
                        item.file.type.startsWith("image/") ||
                        /\.(png|jpe?g|webp|gif|bmp)$/i.test(item.name);

                      return (
                        <div
                          key={item.id}
                          className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-stone-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`p-1.5 rounded shrink-0 ${
                                isImage
                                  ? "bg-emerald-50 text-emerald-700"
                                  : isPdf
                                  ? "bg-red-50 text-red-700"
                                  : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {isImage ? (
                                <ImageIcon className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-stone-900 truncate">
                                  {index + 1}. {item.name}
                                </span>
                                <span className="text-[10px] text-stone-400 font-mono shrink-0">
                                  {formatFileSize(item.size)}
                                </span>
                              </div>

                              {/* Status Subtitle */}
                              <div className="mt-0.5">
                                {item.status === "pending" && (
                                  <span className="text-[11px] text-stone-400">等候排程處理...</span>
                                )}
                                {item.status === "processing" && (
                                  <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                                    <div className="w-2.5 h-2.5 border border-amber-600 border-t-transparent rounded-full animate-spin" />
                                    <span>提取內文並建立神學分類與引句索引...</span>
                                  </span>
                                )}
                                {item.status === "success" && item.resultDoc && (
                                  <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      已收錄為《{item.resultDoc.title}》· 分類：{item.resultDoc.category} (約 {item.resultDoc.wordCount} 字)
                                    </span>
                                  </span>
                                )}
                                {item.status === "error" && (
                                  <span className="text-[11px] text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                                    <span>{item.errorMessage || "檔案無法解析"}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0 flex items-center gap-1">
                            {item.status === "success" && item.resultDoc && (
                              <button
                                type="button"
                                onClick={() => onPreviewDocument(item.resultDoc!)}
                                className="px-2 py-0.5 text-[11px] text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded border border-stone-200 flex items-center gap-1"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>預覽</span>
                              </button>
                            )}
                            {!isProcessingBatch && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"
                                title="從清單中移除"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CURRENT DOCUMENTS LIST */}
          {tab === "list" && (
            <div className="space-y-3">
              {/* Search & Batch Action Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between pb-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="篩選文獻名稱、分類或來源..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                  {listSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setListSearchQuery("")}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-500 justify-between sm:justify-end">
                  <span>
                    總計：<strong className="text-stone-800 font-mono">{documents.length}</strong> 份（
                    {documents.reduce((acc, d) => acc + d.wordCount, 0).toLocaleString()} 字）
                  </span>

                  {customDocs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllCustom}
                      className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded border border-stone-200 flex items-center gap-1 transition-colors"
                    >
                      {selectedDocIds.size === customDocs.length && customDocs.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 text-amber-700" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-stone-400" />
                      )}
                      <span>
                        {selectedDocIds.size === customDocs.length ? "取消全選" : "全選自訂"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Batch Delete Floating Notification / Toolbar */}
              {selectedDocIds.size > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">已選取 {selectedDocIds.size} 份自訂文獻</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds(new Set())}
                      className="px-2 py-1 text-[11px] text-stone-600 hover:text-stone-900"
                    >
                      取消選取
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBatchDelete}
                      className="px-2.5 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white font-medium rounded flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>批量刪除選取項目</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Document List Items */}
              {filteredDocs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl">
                  <FileText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-stone-700">
                    {listSearchQuery ? "未找到符合篩選條件的文獻" : "文獻庫目前無文件"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    請切換至「批量檔案上傳」加入教理講義，或點擊上方「恢復官方預載文獻」。
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden bg-white">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDocIds.has(doc.id);

                    return (
                      <div
                        key={doc.id}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isSelected ? "bg-amber-50/40" : "hover:bg-stone-50/80"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Checkbox for custom documents only */}
                          {!doc.isPreset ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSelectDoc(doc.id)}
                              className="mt-0.5 text-stone-400 hover:text-amber-700 focus:outline-none"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-700" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <div className="w-4" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {doc.imageUrl && (
                                <img
                                  src={doc.imageUrl}
                                  alt={doc.title}
                                  className="w-5 h-5 rounded object-cover border border-stone-200 shrink-0"
                                />
                              )}
                              <h4 className="text-xs font-bold text-stone-900 font-serif truncate">
                                {doc.title}
                              </h4>
                              {doc.imageUrl && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-0.5">
                                  <span>🎨</span>
                                  <span>福音圖</span>
                                </span>
                              )}
                              {doc.isPreset ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                  官方預載
                                </span>
                              ) : (
                                !doc.imageUrl && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-mono shrink-0">
                                    自訂
                                  </span>
                                )
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-stone-500">
                              <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                                {doc.category}
                              </span>
                              <span>約 {doc.wordCount.toLocaleString()} 字</span>
                              {doc.sourceMeta && (
                                <span className="text-stone-400 truncate max-w-[260px]">
                                  {doc.sourceMeta}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onPreviewDocument(doc)}
                            className="px-2.5 py-1 text-xs rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 flex items-center gap-1"
                            title="瀏覽全文"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span className="hidden sm:inline">細閱全文</span>
                          </button>
                          {!doc.isPreset && (
                            <button
                              type="button"
                              onClick={() => onDeleteDocument(doc.id)}
                              className="p-1 text-xs rounded text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="移除此文件"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL PASTE */}
          {tab === "paste" && (
            <form onSubmit={handleManualPasteSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    文獻標題 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="例：本堂主日學和好聖事講義 第3講"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    教理分類範疇
                  </label>
                  <select
                    value={pasteCategory}
                    onChange={(e) => setPasteCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  來源備註（可選）
                </label>
                <input
                  type="text"
                  value={pasteSourceMeta}
                  onChange={(e) => setPasteSourceMeta(e.target.value)}
                  placeholder="例：2026年堂區慕道班教材、某神父講道筆記"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  文獻內容全文 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={8}
                  placeholder="請在此貼上教理講授文獻、教宗講話、聖經經文註釋或個人教案檔案文字..."
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("list")}
                  className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-stone-900 text-amber-100 hover:bg-stone-800 rounded-lg font-medium shadow-xs"
                >
                  確認匯入資料庫
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
