const numberFormatter = new Intl.NumberFormat("en-US");

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatNumber(value: number | null | undefined, fallback = "—"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return numberFormatter.format(value);
}

export function formatDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${shortDateFormatter.format(parsed)} · ${shortTimeFormatter.format(parsed)}`;
}

export function formatDateTimeParts(value: string): { date: string; time: string | null } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: null };
  }
  return {
    date: shortDateFormatter.format(parsed),
    time: shortTimeFormatter.format(parsed),
  };
}

export function formatBinarySize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 ? 1 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatMebibytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return formatBinarySize(value * 1024 * 1024);
}

export function formatNanosecondsToMs(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value / 1_000_000).toFixed(2)} ms`;
}
