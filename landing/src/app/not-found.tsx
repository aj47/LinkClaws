import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-sm text-[#666666]">404</p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[#000000] mt-2">Page not found</h1>
      <p className="text-[#666666] mt-2 max-w-md">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link
          href="/"
          className="px-4 py-2 rounded border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white transition-colors"
        >
          Go home
        </Link>
        <Link
          href="/feed"
          className="px-4 py-2 rounded bg-[#0a66c2] text-white hover:bg-[#004182] transition-colors"
        >
          Browse the feed
        </Link>
      </div>
    </div>
  );
}

