import type { ChangeEvent } from "react";

interface MetricInputProps {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export default function MetricInput({
  value,
  defaultValue,
  onChange,
  className = "",
  placeholder,
  readOnly = false,
}: MetricInputProps) {
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const commonProps = {
    type: "text",
    inputMode: "numeric" as const,
    onChange: handleChange,
    placeholder: placeholder || "0",
    readOnly,
    className: `w-full h-full text-center font-bold text-red-600 bg-transparent focus:outline-none focus:bg-blue-50 transition-colors ${className}`,
  };

  if (value !== undefined) {
    return <input {...commonProps} value={value === 0 ? "" : value} />;
  }

  return <input {...commonProps} defaultValue={defaultValue === 0 ? "" : defaultValue} />;
}
