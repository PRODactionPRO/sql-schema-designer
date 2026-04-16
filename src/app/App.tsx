import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from '@/shared/ui/sonner';

export default function App() {
  return (
    <div className="size-full">
      <RouterProvider router={router} />
      <Toaster position="bottom-right" />
    </div>
  );
}