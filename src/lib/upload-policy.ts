export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

export function uploadSizeError(file: {
  name: string;
  size: number;
}): string | null {
  if (file.size <= MAX_UPLOAD_SIZE_BYTES) return null;
  return `${file.name || "This file"} is too large. The maximum upload size is ${formatMegabytes(MAX_UPLOAD_SIZE_BYTES)}.`;
}
