import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { scanProjectFn } from '@/lib/inngest/functions/scanProject';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanProjectFn],
});
