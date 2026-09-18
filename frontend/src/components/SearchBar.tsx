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
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Search tickets
      </label>
      <input
        ref={ref}
        id="ticket-search"
        type="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Name, email, ticket ID, subject…"
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}
