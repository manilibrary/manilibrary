"use client";

import { stripIndianPhoneInput } from "@/lib/profile-phone";

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
};

export default function IndianPhoneInput({
  id,
  name,
  value,
  onChange,
  disabled,
  required,
  autoComplete = "tel",
  className = "",
  inputClassName = "w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15",
}: Props) {
  return (
    <div className={`flex overflow-hidden rounded-xl border border-ink-200 bg-white focus-within:border-azure-500 focus-within:ring-4 focus-within:ring-azure-500/15 ${className}`}>
      <span className="flex shrink-0 items-center border-r border-ink-200 bg-ink-50 px-3 font-mono text-sm text-ink-600">
        +91
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(stripIndianPhoneInput(e.target.value))}
        disabled={disabled}
        required={required}
        maxLength={10}
        placeholder="9876543210"
        className={`min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 disabled:opacity-60 ${inputClassName}`}
      />
    </div>
  );
}
