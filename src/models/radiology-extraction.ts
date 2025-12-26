/* ============================================================
   Types
   ============================================================ */

export type RadiologyExtraction = {
    summary: string;
    birads: {
        value: number | null;
        confidence: 'low' | 'medium' | 'high';
        evidence: string[];
    };
    breast_density: {
        value: 'A' | 'B' | 'C' | 'D' | null;
        evidence: string[];
    };
    exam: {
        type: string | null;
        laterality: 'left' | 'right' | 'bilateral' | null;
        evidence: string[];
    };
    comparison: {
        prior_exam_date: string | null;
        evidence: string[];
    };
    findings: Array<{
        laterality: 'left' | 'right' | 'bilateral' | 'unknown';
        location: string | null;
        description: string;
        assessment: 'benign' |
        'probably_benign' |
        'suspicious' |
        'highly_suggestive_malignancy' |
        'incomplete' |
        'unknown';
        evidence: string[];
    }>;
    recommendations: Array<{
        action: string;
        timeframe: string | null;
        evidence: string[];
    }>;
    red_flags: string[];
};
