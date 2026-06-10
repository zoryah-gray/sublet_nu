import { Spinner } from '@/components/ui/spinner';

/** Centered full-area spinner used as the fallback for route loading.tsx files. */
export default function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="size-6 text-violet-600" />
    </div>
  );
}
