import type { Ref } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}

export default function SearchBar({ value, onChange, ref }: SearchBarProps) {
  return (
    <div className="flex-1">
      <label
        htmlFor="ticket-search"
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        Search tickets
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path
            d="M9 3.5a5.5 5.5 0 1 0 3.24 9.97l3.14 3.14a.75.75 0 0 0 1.06-1.06l-3.14-3.14A5.5 5.5 0 0 0 9 3.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <input
          ref={ref}
          id="ticket-search"
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Name, email, ticket ID, subject…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
        />
      </div>
    </div>
  );
}
