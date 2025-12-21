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

describe('document upload and summarization', () => {
  it('uploads a PDF file and displays the generated summary', async () => {
    const user = userEvent.setup();
    const summaryText = 'Concise summary for the uploaded document.';
    const pdfText = 'Hello from the PDF file.';

    vi.mocked(summarizeDocument).mockResolvedValueOnce(summaryText);
    vi.mocked(extractTextFromPdf).mockResolvedValueOnce(pdfText);

    render(<App />);

    const file = new File(['%PDF-1.4'], 'example.pdf', {
      type: 'application/pdf'
    });
    const input = screen.getByLabelText(/browse files/i) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('example.pdf')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /generate summaries/i }));

    await waitFor(() => {
      expect(screen.getByText(summaryText)).toBeInTheDocument();
    });

    expect(extractTextFromPdf).toHaveBeenCalledWith(file);
    expect(summarizeDocument).toHaveBeenCalledWith(pdfText);
  });
});
