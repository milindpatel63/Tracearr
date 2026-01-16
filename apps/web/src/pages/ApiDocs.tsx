/**
 * API Documentation page using Swagger UI
 * Styled to match Tracearr's dark theme with cyan accent
 */

import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './ApiDocs.css';

// Get the API base URL for fetching the OpenAPI spec
const API_BASE = import.meta.env.VITE_API_URL || '';

export function ApiDocs() {
  return (
    <div className="swagger-wrapper">
      <div className="swagger-header">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>
      <SwaggerUI url={`${API_BASE}/api/v1/public/docs`} />
    </div>
  );
}
