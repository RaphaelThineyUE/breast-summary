import React, { useCallback, useMemo, useState } from 'react';
import { Upload, FileText, X, Loader, AlertCircle } from 'lucide-react';
import { summarizeDocument } from '../services/openaiService';
import { extractTextFromPdf, type PdfExtractionProgress } from '../services/pdfService';
import './DocumentUploader.css';

interface DocumentSummary {
  filename: string;
  content: string;
  summary: string;
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
              {isProcessing ? (
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
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
