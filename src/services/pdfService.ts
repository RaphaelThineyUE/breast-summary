import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker, type Worker } from 'tesseract.js';

let pdfWorkerReady = false;
let ocrWorkerPromise: Promise<Worker> | null = null;

const tesseractBasePath =
  import.meta.env.VITE_TESSERACT_BASE_PATH ?? '/tesseract';
const tesseractLangPath =
  import.meta.env.VITE_TESSERACT_LANG_PATH ?? `${tesseractBasePath}/tessdata`;
const tesseractWorkerPath =
  import.meta.env.VITE_TESSERACT_WORKER_PATH ?? `${tesseractBasePath}/worker.min.js`;
const tesseractCorePath =
  import.meta.env.VITE_TESSERACT_CORE_PATH ?? `${tesseractBasePath}/tesseract-core.js`;

const ensurePdfWorker = () => {
  if (!pdfWorkerReady) {
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfWorkerReady = true;
  }
};

const getOcrWorker = async () => {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker('eng', undefined, {
        langPath: tesseractLangPath,
        workerPath: tesseractWorkerPath,
        corePath: tesseractCorePath
      });
      return worker;
    })();
  }

  return ocrWorkerPromise;
};

const renderPageToCanvas = async (pdf: PDFDocumentProxy, pageNumber: number) => {
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
  return canvas;
};

const extractTextFromPage = async (pdf: PDFDocumentProxy, pageNumber: number) => {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const textItems = textContent.items
    .map(item => ('str' in item ? item.str : ''))
    .filter(Boolean);

  return textItems.join(' ');
};

const extractTextWithOcr = async (pdf: PDFDocumentProxy, pageNumber: number) => {
  const canvas = await renderPageToCanvas(pdf, pageNumber);
  const worker = await getOcrWorker();
  const result = await worker.recognize(canvas);
  return result.data.text;
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  ensurePdfWorker();

  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const text = await extractTextFromPage(pdf, pageNumber);

    if (text.trim()) {
      pageTexts.push(text);
      continue;
    }

    const ocrText = await extractTextWithOcr(pdf, pageNumber);
    if (ocrText.trim()) {
      pageTexts.push(ocrText);
    }
  }

  return pageTexts.join('\n\n').trim();
};
