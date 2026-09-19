interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm sm:p-5"
    >
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
