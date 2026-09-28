import Link from 'next/link';

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #ddd6fe 1px, transparent 0)`,
        backgroundSize: '28px 28px',
        backgroundColor: '#faf5ff',
      }}
    >
      <Link href="/" className="mb-6 text-2xl font-bold text-violet-800 tracking-tight hover:text-violet-900 transition-colors">
        SubletNU
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
