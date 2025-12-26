import React, { useCallback, useMemo, useState } from 'react';
import { Upload, FileText, X, Loader, AlertCircle } from 'lucide-react';
import { summarizeDocument, summarizeRadiologyReportJson } from '../services/openaiService';
import { extractTextFromPdf, type PdfExtractionProgress } from '../services/pdfService';
import type { RadiologyExtraction } from '../models/radiology-extraction';
import './DocumentUploader.css';

interface DocumentSummary {
  filename: string;
  content: string;
  summary: string;
  radiologyJson?: unknown;
  timestamp: Date;
}

interface DocumentUploaderProps {
  onSummariesGenerated: (summaries: DocumentSummary[]) => void;
  setIsProcessing: (processing: boolean) => void;
  isProcessing: boolean;
}

interface UploadedFile {
  file: File;
  content: string;
  id: string;
}

interface ExtractionStatus extends PdfExtractionProgress {
  fileName: string;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onSummariesGenerated,
  setIsProcessing,
  isProcessing
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus | null>(null);
  const [isRadiologyProcessing, setIsRadiologyProcessing] = useState(false);
  const isBusy = isProcessing || isExtracting;
  const progressPercents = useMemo(() => {
    if (!extractionStatus) {
      return { text: 0, ocr: 0 };
    }
    const text =
      extractionStatus.totalPages > 0
        ? Math.round((extractionStatus.textProcessed / extractionStatus.totalPages) * 100)
        : 0;
    const ocr =
      extractionStatus.ocrTotal > 0
        ? Math.round((extractionStatus.ocrProcessed / extractionStatus.ocrTotal) * 100)
        : 0;
    return { text, ocr };
  }, [extractionStatus]);

  const handleFiles = useCallback(async (files: FileList) => {
    setError(null);
    const fileArray = Array.from(files);
    const pdfFiles = fileArray.filter(file =>
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only (.pdf)');
      return;
    }

    try {
      setIsExtracting(true);
      const processedFiles: UploadedFile[] = [];
      const emptyFiles: string[] = [];
      for (const file of pdfFiles) {
        const content = await extractTextFromPdf(file, (progress) => {
          setExtractionStatus({
            fileName: file.name,
            ...progress
          });
        });
        if (!content.trim()) {
          emptyFiles.push(file.name);
          continue;
        }
        processedFiles.push({
          file,
          content,
          id: Math.random().toString(36).substr(2, 9)
        });
      }

      if (processedFiles.length === 0) {
        setError('No readable text found in the selected PDF files.');
        return;
      }

      if (emptyFiles.length > 0) {
        setError(`No readable text found in: ${emptyFiles.join(', ')}`);
      }

      setUploadedFiles(prev => [...prev, ...processedFiles]);
    } catch {
      setError('Error extracting text from PDF. Please try again.');
    } finally {
      setIsExtracting(false);
      setExtractionStatus(null);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  const generateSummaries = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one PDF document');
      return;
    }

    setIsProcessing(true);
    setIsRadiologyProcessing(false);
    setError(null);

    try {
      const summaries: DocumentSummary[] = [];

      for (const file of uploadedFiles) {
        try {
          const summary = await summarizeDocument(file.content);
          summaries.push({
            filename: file.file.name,
            content: file.content,
            summary,
            timestamp: new Date()
          });
        } catch (error) {
          console.error(`Error summarizing ${file.file.name}:`, error);
          // Continue with other files even if one fails
        }
      }

      if (summaries.length > 0) {
        onSummariesGenerated(summaries);
        setUploadedFiles([]); // Clear uploaded files after processing
      } else {
        setError('Failed to generate summaries. Please check your API configuration.');
      }
    } catch {
      setError('Error processing documents. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const mergeUniqueStrings = (values: string[]) => {
    const cleaned = values.map(value => value.trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  };

  const mergeEvidence = (entries: Array<string[] | undefined>) => {
    const flattened = entries.flatMap(entry => entry ?? []);
    return mergeUniqueStrings(flattened);
  };

  const mergeLaterality = (
    values: Array<RadiologyExtraction['exam']['laterality']>
  ): RadiologyExtraction['exam']['laterality'] => {
    const normalized = values.filter(
      (value): value is NonNullable<RadiologyExtraction['exam']['laterality']> =>
        value !== null && value !== undefined
    );
    if (normalized.includes('bilateral')) {
      return 'bilateral';
    }
    const hasLeft = normalized.includes('left');
    const hasRight = normalized.includes('right');
    if (hasLeft && hasRight) {
      return 'bilateral';
    }
    return normalized[0] ?? null;
  };

  const mergeBreastDensity = (
    values: Array<RadiologyExtraction['breast_density']['value']>
  ): RadiologyExtraction['breast_density']['value'] => {
    const ranking = ['A', 'B', 'C', 'D'];
    const filtered = values.filter(
      (value): value is NonNullable<RadiologyExtraction['breast_density']['value']> =>
        value !== null && value !== undefined
    );
    if (filtered.length === 0) {
      return null;
    }
    return filtered.sort((a, b) => ranking.indexOf(b) - ranking.indexOf(a))[0];
  };

  const mergeBiradsConfidence = (
    values: Array<RadiologyExtraction['birads']['confidence']>
  ): RadiologyExtraction['birads']['confidence'] => {
    const ranking = ['low', 'medium', 'high'];
    const filtered = values.filter(Boolean);
    return filtered.sort((a, b) => ranking.indexOf(b) - ranking.indexOf(a))[0] ?? 'low';
  };

  const mergeComparisonDate = (values: Array<string | null>) => {
    const candidates = values.filter((value): value is string => !!value);
    const parsedDates = candidates
      .map(value => ({ value, time: Date.parse(value) }))
      .filter(entry => !Number.isNaN(entry.time))
      .sort((a, b) => b.time - a.time);
    if (parsedDates.length > 0) {
      return parsedDates[0].value;
    }
    return candidates[0] ?? null;
  };

  const mergeFindings = (entries: RadiologyExtraction['findings'][]) => {
    const flattened = entries.flat();
    const unique = new Map<string, RadiologyExtraction['findings'][number]>();
    for (const finding of flattened) {
      const key = JSON.stringify(finding);
      if (!unique.has(key)) {
        unique.set(key, finding);
      }
    }
    return Array.from(unique.values());
  };

  const mergeRecommendations = (entries: RadiologyExtraction['recommendations'][]) => {
    const flattened = entries.flat();
    const unique = new Map<string, RadiologyExtraction['recommendations'][number]>();
    for (const recommendation of flattened) {
      const key = JSON.stringify(recommendation);
      if (!unique.has(key)) {
        unique.set(key, recommendation);
      }
    }
    return Array.from(unique.values());
  };

  const mergeRadiologyExtractions = (extractions: RadiologyExtraction[]): RadiologyExtraction => {
    const summaryParts = mergeUniqueStrings(extractions.map(item => item.summary));
    const biradsValues = extractions
      .map(item => item.birads.value)
      .filter((value): value is number => typeof value === 'number');
    const biradsValue = biradsValues.length > 0 ? Math.max(...biradsValues) : null;

    return {
      summary: summaryParts.length > 1 ? summaryParts.map(item => `- ${item}`).join('\n') : (summaryParts[0] ?? ''),
      birads: {
        value: biradsValue,
        confidence: mergeBiradsConfidence(extractions.map(item => item.birads.confidence)),
        evidence: mergeEvidence(extractions.map(item => item.birads.evidence))
      },
      breast_density: {
        value: mergeBreastDensity(extractions.map(item => item.breast_density.value)),
        evidence: mergeEvidence(extractions.map(item => item.breast_density.evidence))
      },
      exam: {
        type: extractions.find(item => item.exam.type)?.exam.type ?? null,
        laterality: mergeLaterality(extractions.map(item => item.exam.laterality)),
        evidence: mergeEvidence(extractions.map(item => item.exam.evidence))
      },
      comparison: {
        prior_exam_date: mergeComparisonDate(extractions.map(item => item.comparison.prior_exam_date)),
        evidence: mergeEvidence(extractions.map(item => item.comparison.evidence))
      },
      findings: mergeFindings(extractions.map(item => item.findings)),
      recommendations: mergeRecommendations(extractions.map(item => item.recommendations)),
      red_flags: mergeUniqueStrings(extractions.flatMap(item => item.red_flags))
    };
  };

  const formatRadiologySummary = (merged: RadiologyExtraction, count: number) => {
    const summaryLine = merged.summary?.trim()
      ? merged.summary
      : 'No summary details available.';
    const findingsText = merged.findings.length > 0
      ? merged.findings.map(finding => {
        const location = finding.location ? ` at ${finding.location}` : '';
        return `- ${finding.laterality}${location}: ${finding.description} (${finding.assessment})`;
      }).join('\n')
      : '- None';
    const recommendationsText = merged.recommendations.length > 0
      ? merged.recommendations.map(recommendation => {
        const timeframe = recommendation.timeframe ? ` (${recommendation.timeframe})` : '';
        return `- ${recommendation.action}${timeframe}`;
      }).join('\n')
      : '- None';
    const redFlagsText = merged.red_flags.length > 0
      ? merged.red_flags.join(', ')
      : 'None';

    return [
      `Radiology batch summary (${count} reports)`,
      '',
      'Summary:',
      summaryLine,
      '',
      `BI-RADS: ${merged.birads.value ?? 'Unknown'} (${merged.birads.confidence})`,
      `Breast density: ${merged.breast_density.value ?? 'Unknown'}`,
      `Exam: ${merged.exam.type ?? 'Unknown'} (${merged.exam.laterality ?? 'Unknown'})`,
      `Comparison date: ${merged.comparison.prior_exam_date ?? 'None'}`,
      '',
      'Findings:',
      findingsText,
      '',
      'Recommendations:',
      recommendationsText,
      '',
      `Red flags: ${redFlagsText}`
    ].join('\n');
  };

  const generateRadiologyBatchSummary = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one PDF document.');
      return;
    }

    setIsProcessing(true);
    setIsRadiologyProcessing(true);
    setError(null);

    try {
      if (uploadedFiles.length === 1) {
        const file = uploadedFiles[0];
        const extraction = await summarizeRadiologyReportJson(file.content);
        const summaryText = formatRadiologySummary(extraction, 1);
        onSummariesGenerated([
          {
            filename: `Radiology extraction (${file.file.name})`,
            content: file.content,
            summary: summaryText,
            radiologyJson: JSON.stringify(extraction, null, 2),
            timestamp: new Date()
          }
        ]);
      } else {
        const extractions: RadiologyExtraction[] = [];

        for (const file of uploadedFiles) {
          try {
            const extraction = await summarizeRadiologyReportJson(file.content);
            extractions.push(extraction);
          } catch (error) {
            console.error(`Error extracting radiology data from ${file.file.name}:`, error);
          }
        }

        if (extractions.length === 0) {
          setError('Failed to extract radiology data from the selected PDFs.');
          return;
        }

        const merged = mergeRadiologyExtractions(extractions);
        const summaryText = formatRadiologySummary(merged, extractions.length);
        const combinedContent = uploadedFiles
          .map(file => `--- ${file.file.name} ---\n${file.content}`)
          .join('\n\n');

        onSummariesGenerated([
          {
            filename: `Radiology batch (${extractions.length} PDFs)`,
            content: combinedContent,
            summary: summaryText,
            radiologyJson: JSON.stringify(merged, null, 2),
            timestamp: new Date()
          }
        ]);
      }
    } catch {
      setError('Error extracting radiology data. Please try again.');
    } finally {
      setIsRadiologyProcessing(false);
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setError(null);
  };

  return (
    <div className="document-uploader">
      <div
        className={`drop-zone ${dragActive ? 'active' : ''} ${uploadedFiles.length > 0 ? 'has-files' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="file-input"
          id="file-upload"
          disabled={isBusy}
        />

        <div className="drop-zone-content">
          <Upload size={48} className="upload-icon" />
          <h3>Drop your PDF documents here</h3>
          <p>or <label htmlFor="file-upload" className="file-label">browse files</label></p>
          <p className="file-types">Supports: .pdf files</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {extractionStatus && (
        <div className="extraction-status" role="status" aria-live="polite">
          <div className="status-header">
            <span className="status-title">Processing {extractionStatus.fileName}</span>
            <span className="status-page">
              Page {extractionStatus.currentPage || 1}/
              {extractionStatus.totalPages || '...'}
            </span>
          </div>
          <div className="status-bars">
            <div className="status-track">
              <div
                className="status-fill status-text"
                style={{ width: `${progressPercents.text}%` }}
              />
            </div>
            <div className="status-track status-track-ocr">
              <div
                className="status-fill status-ocr"
                style={{ width: `${progressPercents.ocr}%` }}
              />
            </div>
          </div>
          <div className="status-meta">
            <span>
              Text extraction: {extractionStatus.textProcessed}/
              {extractionStatus.totalPages} pages
            </span>
            <span>
              OCR: {extractionStatus.ocrProcessed}/
              {extractionStatus.ocrTotal} pages
            </span>
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <div className="files-header">
            <h4>Uploaded Files ({uploadedFiles.length})</h4>
            <button onClick={clearFiles} className="clear-files-btn" disabled={isBusy}>
              Clear All
            </button>
          </div>

          <div className="files-list">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-preview">
                <div className="file-item">
                  <div className="file-info">
                    <FileText size={20} />
                    <span className="filename">{file.file.name}</span>
                    <span className="file-size">
                      ({(file.file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="remove-file-btn"
                    disabled={isBusy}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="extracted-text">
                  <div className="extracted-header">
                    <span>Extracted Text</span>
                    <span className="char-count">
                      {file.content.length.toLocaleString()} characters
                    </span>
                  </div>
                  <pre className="extracted-content">{file.content}</pre>
                </div>
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button
              onClick={generateSummaries}
              disabled={isBusy || uploadedFiles.length === 0}
              className="generate-btn"
            >
              {isProcessing && !isRadiologyProcessing ? (
                <>
                  <Loader className="spinner" size={20} />
                  Generating Summaries...
                </>
              ) : isExtracting ? (
                <>
                  <Loader className="spinner" size={20} />
                  Extracting Text...
                </>
              ) : (
                `Generate Summaries (${uploadedFiles.length})`
              )}
            </button>
            {uploadedFiles.length > 0 && (
              <button
                onClick={generateRadiologyBatchSummary}
                disabled={isBusy || uploadedFiles.length === 0}
                className="generate-btn radiology-btn"
              >
                {isRadiologyProcessing ? (
                  <>
                    <Loader className="spinner" size={20} />
                    Extracting Radiology...
                  </>
                ) : uploadedFiles.length > 1 ? (
                  `Extract Radiology Batch (${uploadedFiles.length})`
                ) : (
                  'Extract Radiology'
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
