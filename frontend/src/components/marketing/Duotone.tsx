import { cn } from '@/lib/utils';

export function Duotone({
  src,
  className,
  imgClassName,
  loading = 'lazy',
}: {
  src: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}) {
  return (
    <div className={cn('relative isolate overflow-hidden bg-sidebar', className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading={loading}
        decoding="async"
        width={1200}
        height={800}
        className={cn('size-full object-cover grayscale contrast-110', imgClassName)}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-primary mix-blend-color" />
    </div>
  );
}
