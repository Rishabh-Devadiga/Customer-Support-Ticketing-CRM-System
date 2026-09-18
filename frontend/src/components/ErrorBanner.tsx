interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
