import { useId, useRef, useState } from 'react';
import { AlertCircle, FileText, ImageIcon, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format';
import { acceptAttribute, describeTypes, maxSizeLabel, validateFile, type UploadKind } from '@/lib/uploads';

interface Props {
  kind: UploadKind;
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
}

/**
 * click-or-drop file picker. files are validated against the same rules the
 * server enforces, so a bad file is refused before any upload starts.
 */
export function FileDropzone({
  kind,
  label,
  hint,
  files,
  onChange,
  multiple = false,
  maxFiles = 1,
  disabled,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const Icon = kind === 'logo' ? ImageIcon : FileText;

  const accept = (incoming: FileList | null) => {
    if (!incoming?.length) return;

    const problems: string[] = [];
    const accepted: File[] = [];

    Array.from(incoming).forEach((file) => {
      const problem = validateFile(file, kind);
      if (problem) problems.push(problem);
      else accepted.push(file);
    });

    const room = maxFiles - (multiple ? files.length : 0);
    if (accepted.length > room) {
      problems.push(`You can attach at most ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'}.`);
      accepted.length = Math.max(room, 0);
    }

    setErrors(problems);
    if (accepted.length) onChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));

    // reset so re-picking the same file still fires a change event.
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (index: number) => {
    setErrors([]);
    onChange(files.filter((_, i) => i !== index));
  };

  const errorId = errors.length ? `${inputId}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-body font-medium">
        {label}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-accent' : 'border-border bg-card/40',
          disabled && 'opacity-60'
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={acceptAttribute(kind)}
          multiple={multiple}
          disabled={disabled}
          aria-invalid={errors.length > 0}
          aria-describedby={errorId}
          onChange={(e) => accept(e.target.files)}
        />

        <UploadCloud className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-body">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-body font-semibold text-primary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose {multiple ? 'files' : 'a file'}
          </Button>{' '}
          <span className="text-muted-foreground">or drag and drop</span>
        </p>
        <p className="mt-1 text-meta text-muted-foreground">
          {describeTypes(kind)} · up to {maxSizeLabel(kind)}
          {multiple ? ` · ${maxFiles} files max` : ''}
        </p>
        {hint && <p className="mt-1 text-meta text-muted-foreground">{hint}</p>}
      </div>

      {errors.length > 0 && (
        <ul id={errorId} className="space-y-1">
          {errors.map((message) => (
            <li key={message} role="alert" className="flex items-start gap-1.5 text-meta font-medium text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-body">{file.name}</span>
              <span className="shrink-0 text-meta text-muted-foreground">{formatBytes(file.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => remove(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
