import OpenAI from 'openai';

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your environment variables.'
    );
  }

  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
  });
};

/**
 * Summarizes a document using OpenAI's GPT model
 * @param content - The document content to summarize
 * @param maxLength - Maximum length of the summary (in words)
 * @returns Promise<string> - The generated summary
 */
export const summarizeDocument = async (
  content: string,
  maxLength: number = 200
): Promise<string> => {
  try {
    const openai = getOpenAIClient();
    const model = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';
    console.log('[openaiService] Starting summary request.');
    console.log(`[openaiService] Using model: ${model}`);
    console.log(`[openaiService] Input length (chars): ${content.length}`);

    // Prepare the prompt for summarization
    const prompt = `Please provide a concise and informative summary of the following document. 
The summary should:
- Capture the main points and key information
- Be approximately ${maxLength} words or less
- Be well-structured and easy to understand
- Maintain the original tone and context

Document content:
${content}

Summary:`;

    const response = await openai.responses.create({
      model ,
      input: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates clear, concise, and informative summaries of documents. Focus on extracting the most important information while maintaining clarity and readability.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_output_tokens: Math.min(Math.ceil(maxLength * 1.5), 500),
     temperature: 0.3
    });
 
    console.log('[openaiService] Response received.');
    const summary = response.output_text?.trim();

    if (!summary) {
      throw new Error('No summary generated from OpenAI response');
    }

    console.log(`[openaiService] Summary length (chars): ${summary.length}`);
    return summary;

  } catch (error: unknown) {
    console.error('Error generating summary:', error);

    // Type guard for error handling
    const errorObj = error as { status?: number; message?: string };

    // Handle specific OpenAI errors
    if (errorObj?.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    } else if (errorObj?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    } else if (errorObj?.status === 402) {
      throw new Error('OpenAI API quota exceeded. Please check your account billing.');
    } else if (errorObj?.message?.includes('API key not found')) {
      throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment.');
    }

    // Generic error message for other cases
    throw new Error(`Failed to generate summary: ${errorObj?.message || 'Unknown error'}`);
  }
};

/**
 * Batch summarize multiple documents
 * @param documents - Array of document contents
 * @param maxLength - Maximum length of each summary
 * @returns Promise<string[]> - Array of generated summaries
 */
export const batchSummarizeDocuments = async (
  documents: string[],
  maxLength: number = 200
): Promise<string[]> => {
  const summaries: string[] = [];

  for (const document of documents) {
    try {
      const summary = await summarizeDocument(document, maxLength);
      summaries.push(summary);

      // Add a small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error in batch summarization:', error);
      summaries.push('Failed to generate summary for this document.');
    }
  }

  return summaries;
};

/**
 * Check if OpenAI API is properly configured, write to console.log
 * @returns boolean - True if API key is available
 */ 
export const isOpenAIConfigured = (): boolean => { 
  const configured = !!import.meta.env.VITE_OPENAI_API_KEY;
  console.log(`[openaiService] OpenAI API key configured: ${configured}`);
  return configured;
};

/**
 * Test OpenAI API connection
 * @returns Promise<boolean> - True if connection is successful
 */
export const testOpenAIConnection = async (): Promise<boolean> => {
  try {
    if (!isOpenAIConfigured()) {
      return false;
    }

    const openai = getOpenAIClient();
    const model = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';
    console.log('[openaiService] Testing OpenAI connection.');
    console.log(`[openaiService] Using model: ${model}`);

    // Test with a simple request
    await openai.responses.create({
      model,
      input: [{ role: 'user', content: 'Hello' }],
      max_output_tokens: 5
    });

    console.log('[openaiService] Connection test succeeded.');
    return true;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
};
