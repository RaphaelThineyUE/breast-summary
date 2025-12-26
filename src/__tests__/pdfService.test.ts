import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const {
  getDocumentMock,
  globalWorkerOptions,
  recognizeMock,
  createWorkerMock
} = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
  globalWorkerOptions: { workerSrc: '' },
  recognizeMock: vi.fn(),
  createWorkerMock: vi.fn()
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: getDocumentMock,
  GlobalWorkerOptions: globalWorkerOptions
}));

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock
}));

import { extractTextFromPdf } from '../services/pdfService';

const readSamplePdf = async (filename: string) => {
  const filePath = path.join(process.cwd(), 'public', filename);
  const buffer = await readFile(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const file = new File([buffer], filename, { type: 'application/pdf' });
  return Object.assign(file, {
    arrayBuffer: async () => arrayBuffer
  });
};

const buildPdfMock = (pages: Array<{ textItems: string[]; ocrText?: string }>) => {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (pageNumber: number) => {
      const page = pages[pageNumber - 1];
      return {
        getTextContent: async () => ({
          items: page.textItems.map(text => ({ str: text }))
        }),
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() })
      };
    })
  };
};

describe('extractTextFromPdf', () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    recognizeMock.mockReset();
    createWorkerMock.mockReset();
    createWorkerMock.mockResolvedValue({
      recognize: recognizeMock
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts text from a text-based PDF without OCR', async () => {
    const file = await readSamplePdf('text-based-pdf-sample.pdf');
    const pdfMock = buildPdfMock([
      { textItems: ['Hello', 'from', 'PDF'] }
    ]);

    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdfMock) });

    const text = await extractTextFromPdf(file);

    expect(text).toBe('Hello from PDF');
    expect(createWorkerMock).not.toHaveBeenCalled();
    const [documentArgs] = getDocumentMock.mock.calls[0];
    const data = documentArgs?.data as { byteLength?: number } | undefined;
    expect(data).toBeDefined();
    expect(typeof data?.byteLength).toBe('number');
  });

  it('falls back to OCR when no text is found', async () => {
    const file = await readSamplePdf('image-based-pdf-sample.pdf');
    const pdfMock = buildPdfMock([
      { textItems: [] }
    ]);
    const onProgress = vi.fn();

    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdfMock) });
    recognizeMock.mockResolvedValue({ data: { text: 'OCR extracted text' } });

    const text = await extractTextFromPdf(file, onProgress);

    expect(text).toBe('OCR extracted text');
    expect(createWorkerMock).toHaveBeenCalledWith('eng', undefined, expect.any(Object));
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'ocr' })
    );
  });
});
