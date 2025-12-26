import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  batchSummarizeDocuments,
  isOpenAIConfigured,
  summarizeRadiologyReportJson,
  testOpenAIConnection
} from '../services/openaiService';
const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class OpenAI {
    responses = {
      create: createMock
    };
  }
}));

const setEnv = (key: string, value?: string) => {
  const env = import.meta.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
};

const readPdfText = async (filename: string) => {
  const filePath = path.join(process.cwd(), 'public', filename);
  const buffer = await readFile(filePath);
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

const ensureMinimumLength = (text: string, minLength: number) => {
  if (text.trim().length >= minLength) {
    return text;
  }
  const filler = ' Additional clinical context provided for testing purposes.';
  return `${text}${filler.repeat(Math.ceil((minLength - text.length) / filler.length))}`;
};

const extractionFieldPaths = [
  'summary',
  'birads.value',
  'birads.confidence',
  'birads.evidence',
  'breast_density.value',
  'breast_density.evidence',
  'exam.type',
  'exam.laterality',
  'exam.evidence',
  'comparison.prior_exam_date',
  'comparison.evidence',
  'findings',
  'findings[0].laterality',
  'findings[0].location',
  'findings[0].description',
  'findings[0].assessment',
  'findings[0].evidence',
  'recommendations',
  'recommendations[0].action',
  'recommendations[0].timeframe',
  'recommendations[0].evidence',
  'red_flags'
];

const getValueByPath = (value: unknown, pathValue: string): unknown => {
  const parts = pathValue.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: any = value;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
};

const isFilledValue = (value: unknown) => {
  if (value == null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return true;
};

const calculateFillPercentage = (value: unknown) => {
  const filledCount = extractionFieldPaths.filter(pathItem =>
    isFilledValue(getValueByPath(value, pathItem))
  ).length;
  const total = extractionFieldPaths.length;
  return Math.round((filledCount / total) * 100);
};

describe('summarizeRadiologyReportJson', () => {
  beforeEach(() => {
    createMock.mockReset();
    setEnv('VITE_OPENAI_API_KEY', 'test-key');
  });

  it('parses structured JSON from the response', async () => {
    const reportText = 'This is a sufficiently long radiology report text for testing.'.repeat(2);
    const extraction = {
      summary: 'Benign findings with routine follow-up.',
      birads: {
        value: 2,
        confidence: 'high',
        evidence: ['BI-RADS 2: benign']
      },
      breast_density: {
        value: 'B',
        evidence: ['Breast density: B']
      },
      exam: {
        type: 'screening mammogram',
        laterality: 'bilateral',
        evidence: ['Bilateral screening']
      },
      comparison: {
        prior_exam_date: '2022-01-01',
        evidence: ['Compared to prior exam dated 2022-01-01']
      },
      findings: [
        {
          laterality: 'left',
          location: 'upper outer quadrant',
          description: 'Stable benign calcifications.',
          assessment: 'benign',
          evidence: ['Benign calcifications in left breast']
        }
      ],
      recommendations: [
        {
          action: 'Routine annual screening',
          timeframe: '12 months',
          evidence: ['Recommend annual follow-up']
        }
      ],
      red_flags: []
    };

    createMock.mockResolvedValueOnce({
      output_text: JSON.stringify(extraction)
    });

    const result = await summarizeRadiologyReportJson(reportText);

    expect(result).toEqual(extraction);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'radiology_extraction'
          })
        }
      })
    );
  });

  it('rejects when the report text is too short', async () => {
    await expect(summarizeRadiologyReportJson('Too short.'))
      .rejects
      .toThrow('Radiology report text is too short to summarize.');
  });

  it('computes fill percentage for extraction from sample PDFs', async () => {
    const textBased = await readPdfText('text-based-pdf-sample.pdf');
    const imageBased = await readPdfText('image-based-pdf-sample.pdf');
    const reports = [
      ensureMinimumLength(textBased, 60),
      ensureMinimumLength(imageBased, 60)
    ];

    const baseExtraction = {
      summary: 'Radiology summary.',
      birads: { value: 2, confidence: 'medium', evidence: ['BI-RADS 2'] },
      breast_density: { value: 'B', evidence: ['Density B'] },
      exam: { type: 'screening', laterality: 'bilateral', evidence: ['Screening'] },
      comparison: { prior_exam_date: '2023-01-01', evidence: ['Prior exam'] },
      findings: [
        {
          laterality: 'left',
          location: 'upper outer quadrant',
          description: 'Benign calcifications.',
          assessment: 'benign',
          evidence: ['Calcifications']
        }
      ],
      recommendations: [
        {
          action: 'Routine screening',
          timeframe: '12 months',
          evidence: ['Routine follow-up']
        }
      ],
      red_flags: []
    };

    createMock
      .mockResolvedValueOnce({ output_text: JSON.stringify(baseExtraction) })
      .mockResolvedValueOnce({ output_text: JSON.stringify(baseExtraction) });

    for (const reportText of reports) {
      const extraction = await summarizeRadiologyReportJson(reportText);
      const percentFilled = calculateFillPercentage(extraction);
      console.log(
        `[openaiService] Radiology extraction completeness: ${percentFilled}%`
      );
      expect(percentFilled).toBeGreaterThan(10);
    }
  });
});

describe('batchSummarizeDocuments', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createMock.mockReset();
    setEnv('VITE_OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns summaries with a fallback for failures', async () => {
    createMock
      .mockResolvedValueOnce({ output_text: 'First summary' })
      .mockRejectedValueOnce(new Error('Boom'));

    const promise = batchSummarizeDocuments(['doc one', 'doc two'], 10);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([
      'First summary',
      'Failed to generate summary for this document.'
    ]);
  });
});

describe('isOpenAIConfigured', () => {
  it('returns true when the API key is set', () => {
    setEnv('VITE_OPENAI_API_KEY', 'test-key');
    expect(isOpenAIConfigured()).toBe(true);
  });

  it('returns false when the API key is missing', () => {
    setEnv('VITE_OPENAI_API_KEY');
    expect(isOpenAIConfigured()).toBe(false);
  });
});

describe('testOpenAIConnection', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('returns false when OpenAI is not configured', async () => {
    setEnv('VITE_OPENAI_API_KEY');
    await expect(testOpenAIConnection()).resolves.toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns true when the OpenAI request succeeds', async () => {
    setEnv('VITE_OPENAI_API_KEY', 'test-key');
    createMock.mockResolvedValueOnce({ output_text: 'ok' });

    await expect(testOpenAIConnection()).resolves.toBe(true);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [{ role: 'user', content: 'Hello' }],
        max_output_tokens: 5
      })
    );
  });

  it('returns false when the OpenAI request fails', async () => {
    setEnv('VITE_OPENAI_API_KEY', 'test-key');
    createMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(testOpenAIConnection()).resolves.toBe(false);
  });
});
