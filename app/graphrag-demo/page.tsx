'use client';

import { useState } from 'react';
import { DocumentUpload, DocumentList, GraphRAGIndicator } from '@/components/graphrag';
import type { Citation } from '@/lib/graphrag/service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Example page demonstrating GraphRAG components
 * This can be accessed at /graphrag-demo
 */
export default function GraphRAGDemoPage() {
  const { user } = useAuth();
  const userId = user?.id || 'demo-user';

  const [refreshKey, setRefreshKey] = useState(0);

  // Example citations for demonstration
  const exampleCitations: Citation[] = [
    {
      source: 'Project Documentation.pdf',
      content: 'The system uses Neo4j for knowledge graph storage and Graphiti for automatic entity extraction.',
      confidence: 0.95,
    },
    {
      source: 'Technical Specs.docx',
      content: 'GraphRAG enhances responses by injecting relevant context from user documents.',
      confidence: 0.87,
    },
  ];

  const handleUploadComplete = () => {
    // Trigger document list refresh
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            GraphRAG Document Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Upload and manage documents for enhanced AI responses
          </p>
        </div>

        {/* GraphRAG Indicator Demo */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Example: Enhanced Response Indicator
          </h2>
          <GraphRAGIndicator
            citations={exampleCitations}
            contextsUsed={exampleCitations.length}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div>
            <DocumentUpload
              userId={userId}
              onUploadComplete={handleUploadComplete}
            />
          </div>

          {/* List Section */}
          <div>
            <DocumentList key={refreshKey} userId={userId} />
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            How It Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>Upload your documents (PDF, TXT, MD, or DOCX)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>Documents are automatically parsed and processed with Graphiti</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>Entities and relationships are extracted and stored in Neo4j</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>When you chat, relevant context is automatically injected from your documents</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">5.</span>
              <span>GraphRAG indicator shows which documents were used to enhance responses</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
