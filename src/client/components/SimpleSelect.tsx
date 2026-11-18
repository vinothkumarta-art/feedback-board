import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

/** A select over a short list of labelled values. */
export function SimpleSelect({
  value,
  items,
  onChange,
  label,
  testId,
  disabled,
  size,
  className,
}: {
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  testId?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next as string);
      }}
    >
      <SelectTrigger aria-label={label} data-testid={testId} size={size} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
