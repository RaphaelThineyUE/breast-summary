# Document Summarizer

A responsive React TypeScript web application that uses AI to generate summaries of uploaded documents. Built with Vite, React, and OpenAI's API.

## Features

- **Drag & Drop Interface**: Easy document upload with drag-and-drop support
- **Multiple File Support**: Upload and process multiple documents at once
- **AI-Powered Summaries**: Generate concise summaries using OpenAI's GPT models
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Download & Copy**: Export summaries or copy them to clipboard
- **File Support**: Supports .txt, .md, and .json files
- **Real-time Processing**: Visual feedback during document processing

## Prerequisites

- Node.js (version 20.19+ or 22.12+)
- OpenAI API account and API key

## Getting Started

1. **Clone and setup the project**:
   ```bash
   git clone <your-repo-url>
   cd breast-summary
   npm install
   ```

2. **Configure OpenAI API**:
   - Copy the environment template:
     ```bash
     cp .env.example .env
     ```
   - Add your OpenAI API key to the `.env` file:
     ```
     VITE_OPENAI_API_KEY=your_actual_api_key_here
     ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## Usage

1. **Upload Documents**: 
   - Drag and drop files onto the upload area, or
   - Click to browse and select files
   - Supported formats: .txt, .md, .json

2. **Generate Summaries**:
   - Click "Generate Summaries" after uploading
   - Wait for AI processing to complete

3. **View and Manage Results**:
   - Read generated summaries
   - Expand to view original content
   - Copy summaries to clipboard
   - Download summaries as text files
   - Clear all results when done

## Environment Variables

- `VITE_OPENAI_API_KEY`: Your OpenAI API key (required)

## Project Structure

```
src/
├── components/
│   ├── DocumentUploader.tsx    # File upload and drag-drop interface
│   ├── DocumentUploader.css    # Uploader component styles
│   ├── SummaryDisplay.tsx      # Display generated summaries
│   └── SummaryDisplay.css      # Summary display styles
├── services/
│   └── openaiService.ts        # OpenAI API integration
├── App.tsx                     # Main application component
├── App.css                     # Global application styles
└── main.tsx                    # Application entry point
```

## Technologies Used

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and development server
- **OpenAI API** - AI-powered text summarization
- **Lucide React** - Icon library
- **CSS3** - Modern responsive styling

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Quality

The project includes:
- TypeScript for type safety
- ESLint for code quality
- Modern React patterns and hooks
- Responsive CSS design

## Security Considerations

⚠️ **Important**: This application currently runs OpenAI API calls directly from the browser for development purposes. For production deployment:

1. Move OpenAI API calls to a backend server
2. Implement proper API key management
3. Add request validation and rate limiting
4. Consider user authentication

## API Usage and Costs

This application uses OpenAI's GPT-3.5-turbo model. Be aware of:
- API costs per request
- Rate limiting (requests per minute)
- Monthly usage quotas

Monitor your OpenAI dashboard for usage and billing information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check the console for error messages
2. Verify your OpenAI API key is valid
3. Ensure you have sufficient API quota
4. Check that uploaded files are in supported formats
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
