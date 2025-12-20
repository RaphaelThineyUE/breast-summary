import React, { useState } from 'react';
import { FileText, Calendar, ChevronDown, ChevronUp, Copy, Download, Check } from 'lucide-react';
import './SummaryDisplay.css';

interface DocumentSummary {
  filename: string;
  content: string;
  summary: string;
  timestamp: Date;
}

interface SummaryDisplayProps {
  summaries: DocumentSummary[];
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summaries }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      const newCopied = new Set(copiedItems);
      newCopied.add(index);
      setCopiedItems(newCopied);

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const updated = new Set(prev);
          updated.delete(index);
          return updated;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadSummary = (summary: DocumentSummary) => {
    const content = `Document: ${summary.filename}
Generated: ${summary.timestamp.toLocaleString()}

SUMMARY:
${summary.summary}

ORIGINAL CONTENT:
${summary.content}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${summary.filename.replace(/\.[^/.]+$/, '')}_summary.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  return (
    <div className="summary-display">
      {summaries.map((summary, index) => {
        const isExpanded = expandedItems.has(index);
        const isCopied = copiedItems.has(index);

        return (
          <div key={index} className="summary-card">
            <div className="summary-header">
              <div className="file-info">
                <FileText size={20} className="file-icon" />
                <div className="file-details">
                  <h3 className="filename">{summary.filename}</h3>
                  <div className="timestamp">
                    <Calendar size={14} />
                    <span>{formatTimestamp(summary.timestamp)}</span>
                  </div>
                </div>
              </div>

              <div className="header-actions">
                <button
                  onClick={() => copyToClipboard(summary.summary, index)}
                  className="action-btn copy-btn"
                  title="Copy summary"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>

                <button
                  onClick={() => downloadSummary(summary)}
                  className="action-btn download-btn"
                  title="Download summary"
                >
                  <Download size={16} />
                </button>

                <button
                  onClick={() => toggleExpanded(index)}
                  className="action-btn expand-btn"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            <div className="summary-content">
              <div className="summary-section">
                <h4 className="section-title">Summary</h4>
                <div className="summary-text">{summary.summary}</div>
              </div>

              {isExpanded && (
                <div className="original-content-section">
                  <h4 className="section-title">Original Content</h4>
                  <div className="original-content">
                    <pre>{summary.content}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryDisplay;