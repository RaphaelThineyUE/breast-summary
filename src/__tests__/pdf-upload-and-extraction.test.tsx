import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { summarizeDocument } from '../services/openaiService';
import { extractTextFromPdf } from '../services/pdfService';

vi.mock('../services/openaiService', () => ({
  summarizeDocument: vi.fn()
}));

vi.mock('../services/pdfService', () => ({
  extractTextFromPdf: vi.fn()
}));

const readSamplePdf = async (filename: string) => {
  const filePath = path.join(process.cwd(), 'public', filename);
  const buffer = await readFile(filePath);
  return {
    buffer,
    file: new File([buffer], filename, { type: 'application/pdf' })
  };
};

const extractPdfText = async (buffer: Buffer) => {
  const standardFontDataUrl = path.join(
    process.cwd(),
    'node_modules',
    'pdfjs-dist',
    'standard_fonts'
  );
  const data = new Uint8Array(buffer);
  const pdf = await getDocument({
    data,
    disableWorker: true,
    standardFontDataUrl
  } as Parameters<typeof getDocument>[0] & { disableWorker: boolean }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const textItems = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .filter(Boolean);
    const pageText = textItems.join(' ').trim();

    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  return pageTexts.join('\n\n').trim();
};

describe('sample PDF uploads', () => {
  it('uploads the sample PDFs and shows extracted text (OCR when needed) in summaries', async () => {
    const user = userEvent.setup();
    const textBasedSample = await readSamplePdf('text-based-pdf-sample.pdf');
    const imageBasedSample = await readSamplePdf('image-based-pdf-sample.pdf');
    const extractedText = await extractPdfText(textBasedSample.buffer);
    const textBasedSummary = extractedText || 'Fallback text for text-based PDF.';
    const imageBasedSummary = `OCR extracted text for ${imageBasedSample.file.name}`;

    vi.mocked(extractTextFromPdf).mockImplementation(async (file: File) => {
      if (file.name === textBasedSample.file.name) {
        return textBasedSummary;
      }
      return imageBasedSummary;
    });

    vi.mocked(summarizeDocument).mockImplementation(async (content: string) => content);

    render(<App />);

    const input = screen.getByLabelText(/browse files/i) as HTMLInputElement;
    await user.upload(input, [textBasedSample.file, imageBasedSample.file]);

    await waitFor(() => {
      expect(screen.getByText(textBasedSample.file.name)).toBeInTheDocument();
      expect(screen.getByText(imageBasedSample.file.name)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /generate summaries/i }));

    await waitFor(() => {
      expect(screen.getByText(textBasedSummary)).toBeInTheDocument();
      expect(screen.getByText(imageBasedSummary)).toBeInTheDocument();
    });

    expect(extractTextFromPdf).toHaveBeenCalledTimes(2);
    expect(summarizeDocument).toHaveBeenCalledWith(textBasedSummary);
    expect(summarizeDocument).toHaveBeenCalledWith(imageBasedSummary);
  });
});
