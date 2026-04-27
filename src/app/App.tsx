import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import { Toaster } from '@/shared/ui/sonner';
import { queryClient } from '@/shared/api/query-client';

export default function App() {
  return (
    <div className="size-full">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      <Toaster position="bottom-right" />
    </div>
  );
}
