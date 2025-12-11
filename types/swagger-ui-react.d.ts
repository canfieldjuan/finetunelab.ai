declare module 'swagger-ui-react' {
  import { ComponentType } from 'react';

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    docExpansion?: 'list' | 'full' | 'none';
    defaultModelsExpandDepth?: number;
    displayRequestDuration?: boolean;
    filter?: boolean | string;
    requestInterceptor?: (request: unknown) => unknown;
    responseInterceptor?: (response: unknown) => unknown;
    onComplete?: (system: unknown) => void;
    plugins?: unknown[];
    supportedSubmitMethods?: string[];
    tryItOutEnabled?: boolean;
    layout?: string;
    persistAuthorization?: boolean;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}
