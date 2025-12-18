'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import dynamic from 'next/dynamic';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(
  () => import('swagger-ui-react').then(mod => mod.default),
  { ssr: false }
);

import 'swagger-ui-react/swagger-ui.css';

export default function APISpecPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  // Public page - no auth required
  // if (loading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-center">
  //         <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-muted-foreground">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-api-spec" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">🔌 Interactive API Documentation</h1>
            <p className="text-xl text-muted-foreground mb-4">
              Explore and test the Fine-Tune Labs API with Swagger UI
            </p>

            {/* Info boxes */}
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">📥 Download Spec</h3>
                <div className="flex gap-2">
                  <a
                    href="/openapi.json"
                    download
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    JSON Format
                  </a>
                  <span className="text-muted-foreground">|</span>
                  <a
                    href="/openapi.yaml"
                    download
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    YAML Format
                  </a>
                </div>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h3 className="font-semibold mb-2">🔑 Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Click &quot;Authorize&quot; below and enter your Bearer token to test endpoints
                </p>
              </div>
            </div>
          </div>

          {/* Swagger UI */}
          <div className="swagger-container">
            <SwaggerUI
              url="/openapi.json"
              docExpansion="list"
              defaultModelsExpandDepth={1}
              persistAuthorization={true}
              tryItOutEnabled={true}
              filter={true}
              displayRequestDuration={true}
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Swagger UI Dark Mode Support */
        .swagger-container {
          background: var(--background);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        /* Override Swagger UI colors for dark mode */
        @media (prefers-color-scheme: dark) {
          .swagger-ui {
            filter: invert(0.88) hue-rotate(180deg);
          }

          .swagger-ui .info .title,
          .swagger-ui .opblock-tag,
          .swagger-ui .opblock-summary-description,
          .swagger-ui .btn,
          .swagger-ui .opblock .opblock-summary-method {
            filter: invert(1) hue-rotate(180deg);
          }
        }

        /* Make Swagger UI responsive */
        .swagger-ui .wrapper {
          padding: 0;
        }

        .swagger-ui .info {
          margin: 20px 0;
        }
      `}</style>
    </div>
  );
}
