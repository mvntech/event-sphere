const MB = 1024 * 1024;

export const IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export const DOCUMENT_TYPES: Record<string, string[]> = {
  ...IMAGE_TYPES,
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const UPLOAD_LIMITS = {
  logo: { maxBytes: 2 * MB, types: IMAGE_TYPES, label: 'logo' },
  document: { maxBytes: 5 * MB, types: DOCUMENT_TYPES, label: 'document' },
} as const;

export const MAX_DOCUMENTS = 5;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

/** extensions for an `<input accept>` attribute. */
export function acceptAttribute(kind: UploadKind) {
  return [...new Set(Object.values(UPLOAD_LIMITS[kind].types).flat())].join(',');
}

/** human-readable list of allowed formats, e.g. "JPG, PNG, WEBP". */
export function describeTypes(kind: UploadKind) {
  return [...new Set(Object.values(UPLOAD_LIMITS[kind].types).flat())]
    .map((ext) => ext.replace('.', '').toUpperCase())
    .join(', ');
}

export function maxSizeLabel(kind: UploadKind) {
  return `${UPLOAD_LIMITS[kind].maxBytes / MB}MB`;
}

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(file: File, kind: UploadKind): string | null {
  const { maxBytes, types, label } = UPLOAD_LIMITS[kind];

  const allowedExts = types[file.type];
  if (!allowedExts) {
    return `"${file.name}" is not an accepted ${label} type. Allowed: ${describeTypes(kind)}.`;
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return `"${file.name}" has a ${ext || 'missing'} extension that does not match its contents.`;
  }

  if (file.size > maxBytes) {
    return `"${file.name}" is too large. The limit for a ${label} is ${maxSizeLabel(kind)}.`;
  }

  return null;
}
