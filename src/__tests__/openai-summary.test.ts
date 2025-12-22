import { describe, expect, it, vi, beforeEach } from 'vitest';
import { summarizeDocument } from '../services/openaiService';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: createMock
      }
    };
  }
}));

describe('openai summarization', () => {
  beforeEach(() => {
    createMock.mockReset();
    Object.assign(import.meta.env as Record<string, string>, {
      VITE_OPENAI_API_KEY: 'test-key'
    });
  });

  it('summarizes text into 10 words or less', async () => {
    const responseSummary = 'Ten words or less summary goes right here.';
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: responseSummary } }]
    });

    const summary = await summarizeDocument(
      'This is a longer piece of content that needs summarization.',
      10
    );

    expect(summary).toBe(responseSummary);
    expect(summary.split(/\s+/)).toHaveLength(8);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 15
      })
    );
  });
});
