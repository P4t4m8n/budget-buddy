"use client";

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

export type SelectOption = { value: string; label: string };

export default function SelectField({
  name,
  options,
  value,
  defaultValue,
  placeholder,
  labelId,
  error,
  onChange,
}: {
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  // id of the element that labels this control (see FormField's labelId)
  labelId?: string;
  error?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      name={name}
      labelId={labelId}
      error={error}
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
      onChange={(e) => onChange?.(e.target.value)}
      renderValue={(selected) =>
        selected ? (
          options.find((o) => o.value === selected)?.label
        ) : (
          <span className="text-neutral-500">{placeholder}</span>
        )
      }
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  );
}
