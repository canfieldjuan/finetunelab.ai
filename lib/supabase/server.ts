/**
 * Server-Side Supabase Client Export
 * Re-exports createServerClient as createClient for convenience
 */

import { createServerClient } from './server-client';

export const createClient = createServerClient;
