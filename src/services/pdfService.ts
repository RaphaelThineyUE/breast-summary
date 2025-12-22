import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker, type Worker } from 'tesseract.js';

let pdfWorkerReady = false;
let ocrWorkerPromise: Promise<Worker> | null = null;

const defaultTesseractWorkerPath = new URL(
  'tesseract.js/dist/worker.min.js',
  import.meta.url
).toString();
const defaultTesseractCorePath = new URL(
  'tesseract.js-core/tesseract-core.wasm.js',
  import.meta.url
).toString();
const defaultTesseractLangPath = 'https://tessdata.projectnaptha.com/4.0.0';

const tesseractLangPath =
  import.meta.env.VITE_TESSERACT_LANG_PATH ?? defaultTesseractLangPath;
const tesseractWorkerPath =
  import.meta.env.VITE_TESSERACT_WORKER_PATH ?? defaultTesseractWorkerPath;
const tesseractCorePath =
  import.meta.env.VITE_TESSERACT_CORE_PATH ?? defaultTesseractCorePath;

const ensurePdfWorker = () => {
  if (!pdfWorkerReady) {
    console.log('[pdfService] Setting pdf.js worker source.');
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfWorkerReady = true;
    console.log('[pdfService] pdf.js worker ready.');
  }
};

const getOcrWorker = async () => {
  if (!ocrWorkerPromise) {
    console.log('[pdfService] Creating Tesseract worker.');
    ocrWorkerPromise = (async () => {
      const worker = await createWorker('eng', undefined, {
        langPath: tesseractLangPath,
        workerPath: tesseractWorkerPath,
        corePath: tesseractCorePath
      });
      console.log('[pdfService] Tesseract worker created.');
      return worker;
    })();
  } else {
    console.log('[pdfService] Reusing cached Tesseract worker.');
  }

  return ocrWorkerPromise;
};

const renderPageToCanvas = async (pdf: PDFDocumentProxy, pageNumber: number) => {
  console.log(`[pdfService] Rendering page ${pageNumber} to canvas.`);
  const pdfPage = await pdf.getPage(pageNumber);
  const viewport = pdfPage.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to render PDF page for OCR.');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await pdfPage.render({ canvasContext: context, viewport }).promise;
  console.log(`[pdfService] Rendered page ${pageNumber} to canvas.`);
  return canvas;
};

const extractTextFromPage = async (pdf: PDFDocumentProxy, pageNumber: number) => {
  console.log(`[pdfService] Extracting text from page ${pageNumber}.`);
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const textItems = textContent.items
    .map(item => ('str' in item ? item.str : ''))
    .filter(Boolean);

  console.log(
    `[pdfService] Extracted ${textItems.length} text items from page ${pageNumber}.`
  );
  return textItems.join(' ');
};

const extractTextWithOcr = async (pdf: PDFDocumentProxy, pageNumber: number) => {
  console.log(`[pdfService] Running OCR on page ${pageNumber}.`);
  const canvas = await renderPageToCanvas(pdf, pageNumber);
  const worker = await getOcrWorker();
  const result = await worker.recognize(canvas);
  console.log(`[pdfService] OCR complete for page ${pageNumber}.`);
  return result.data.text;
};

export interface PdfExtractionProgress {
  totalPages: number;
  textProcessed: number;
  ocrProcessed: number;
  ocrTotal: number;
  currentPage: number;
  stage: 'text' | 'ocr';
}

export const extractTextFromPdf = async (
  file: File,
  onProgress?: (progress: PdfExtractionProgress) => void
): Promise<string> => {
  console.log('[pdfService] Starting PDF text extraction.');
  ensurePdfWorker();

  console.log('[pdfService] Reading PDF file into ArrayBuffer.');
  const data = await file.arrayBuffer();
  console.log('[pdfService] Loading PDF document.');
  const pdf = await getDocument({ data }).promise;
  console.log(`[pdfService] PDF loaded with ${pdf.numPages} pages.`);
  const pageTexts: string[] = [];
  const progress: PdfExtractionProgress = {
    totalPages: pdf.numPages,
    textProcessed: 0,
    ocrProcessed: 0,
    ocrTotal: 0,
    currentPage: 0,
    stage: 'text'
  };

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    console.log(`[pdfService] Processing page ${pageNumber}/${pdf.numPages}.`);
    progress.currentPage = pageNumber;
    progress.stage = 'text';
    onProgress?.({ ...progress });
    const text = await extractTextFromPage(pdf, pageNumber);
    progress.textProcessed += 1;
    onProgress?.({ ...progress });

    if (text.trim()) {
      console.log(`[pdfService] Page ${pageNumber} has text content.`);
      pageTexts.push(text);
      continue;
    }

    console.log(`[pdfService] Page ${pageNumber} is empty, falling back to OCR.`);
    progress.ocrTotal += 1;
    progress.stage = 'ocr';
    onProgress?.({ ...progress });
    const ocrText = await extractTextWithOcr(pdf, pageNumber);
    progress.ocrProcessed += 1;
    onProgress?.({ ...progress });
    if (ocrText.trim()) {
      console.log(`[pdfService] OCR returned text for page ${pageNumber}.`);
      pageTexts.push(ocrText);
    } else {
      console.log(`[pdfService] OCR returned no text for page ${pageNumber}.`);
    }
  }

  console.log('[pdfService] Finished PDF text extraction.');
  return pageTexts.join('\n\n').trim();
};
