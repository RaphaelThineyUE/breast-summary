import { useState } from 'react';
import DocumentUploader from './components/DocumentUploader';
import SummaryDisplay from './components/SummaryDisplay';
import { FileText, Brain, Sparkles } from 'lucide-react';
import './App.css';

interface DocumentSummary {
  filename: string;
  content: string;
  summary: string;
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
            <Brain className="logo-icon" size={32} />
            <h1>Document Summarizer</h1>
          </div>
          <p className="tagline">
            <Sparkles size={16} />
            Upload documents and get AI-powered summaries instantly
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
