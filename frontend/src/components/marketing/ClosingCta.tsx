import type { ReactNode } from 'react';

export function ClosingCta({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <section className="bg-sidebar">
      <div className="container-page flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
        <div className="max-w-xl">
          <h2 className="text-title text-sidebar-foreground">{title}</h2>
          <p className="mt-3 text-lede text-sidebar-foreground/80">{body}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </section>
  );
}
