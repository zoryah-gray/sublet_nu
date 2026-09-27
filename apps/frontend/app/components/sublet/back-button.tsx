'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-800 transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      Back
    </button>
  );
}
