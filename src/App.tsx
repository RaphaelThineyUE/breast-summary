import { useState } from 'react';
import DocumentUploader from './components/DocumentUploader';
import SummaryDisplay from './components/SummaryDisplay';
import { FileText, Sparkles } from 'lucide-react';
import './App.css';

interface DocumentSummary {
  filename: string;
  content: string;
  summary: string;
  radiologyJson?: unknown;
  timestamp: Date;
}

function App() {
  const [summaries, setSummaries] = useState<DocumentSummary[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSummariesGenerated = (newSummaries: DocumentSummary[]) => {
    setSummaries(prev => [...prev, ...newSummaries]);
  };

  const clearSummaries = () => {
    setSummaries([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="ribbon-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" role="img" focusable="false">
                <path
                  d="M32 6c-8 0-14.5 6.5-14.5 14.5 0 9.7 7.4 15.3 13.6 21.3 1.2 1.1 2.7 1.8 4.2 1.8s3-0.6 4.2-1.8c6.2-6 13.6-11.6 13.6-21.3C47.1 12.5 40 6 32 6z"
                  fill="url(#ribbonGradient)"
                />
                <path
                  d="M24.4 38.2L14 58l12.5-4.2L32 60l5.5-6.2L50 58 39.6 38.2"
                  fill="#b3124a"
                />
                <defs>
                  <linearGradient id="ribbonGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="logo-text">
              <h1>Breast Cancer Surgeon Console</h1>
              <div className="ai-badge">
                <Sparkles size={14} />
                <span>AI-assisted clinical summaries</span>
              </div>
            </div>
          </div>
          <p className="tagline">
            Imaging and pathology notes distilled for surgical planning.
          </p>
        </div>
      </header>

      <main className="main-content">
        <div className="upload-section">
          <DocumentUploader
            onSummariesGenerated={handleSummariesGenerated}
            setIsProcessing={setIsProcessing}
            isProcessing={isProcessing}
          />
        </div>

        {summaries.length > 0 && (
          <div className="summaries-section">
            <div className="section-header">
              <div className="section-title">
                <FileText size={20} />
                <h2>Generated Summaries ({summaries.length})</h2>
              </div>
              <button
                onClick={clearSummaries}
                className="clear-button"
                disabled={isProcessing}
              >
                Clear All
              </button>
            </div>
            <SummaryDisplay summaries={summaries} />
          </div>
        )}

        {summaries.length === 0 && !isProcessing && (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>No documents processed yet</h3>
            <p>Upload your documents above to get started with AI-powered summarization</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
