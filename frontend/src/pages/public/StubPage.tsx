import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type Stub = { kind: 'product' | 'legal'; title: string; summary: string };

const STUBS: Record<string, Stub> = {
  'floor-plans': {
    kind: 'product',
    title: 'Floor plans',
    summary: 'A snap-to-grid hall plan that organizers draw, exhibitors reserve off, and attendees navigate by.',
  },
  schedule: {
    kind: 'product',
    title: 'Schedule builder',
    summary: 'Sessions, speakers, rooms and capacity in one place, with changes reaching everyone live.',
  },
  'exhibitor-directory': {
    kind: 'product',
    title: 'Exhibitor directory',
    summary: 'Every stand at the show, searchable by category, product or plain description of what you are after.',
  },
  messaging: {
    kind: 'product',
    title: 'Messaging',
    summary: 'Attendees reach exhibitors, exhibitors reach organizers, neighbours find each other — in real time.',
  },
  ai: {
    kind: 'product',
    title: 'AI assistant',
    summary: 'Personalised itineraries, natural-language search and feedback triaged the moment it lands.',
  },
  terms: {
    kind: 'legal',
    title: 'Terms of Service',
    summary: 'The terms that would govern use of EventSphere Management.',
  },
  'privacy-policy': {
    kind: 'legal',
    title: 'Privacy Policy',
    summary: 'How EventSphere Management collects, stores and returns your data.',
  },
  cookies: {
    kind: 'legal',
    title: 'Cookie Policy',
    summary: 'What EventSphere Management stores in your browser, and why.',
  },
  accessibility: {
    kind: 'legal',
    title: 'Accessibility Statement',
    summary: 'The accessibility standard this build holds itself to, and where it falls short.',
  },
};

export default function StubPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams();
  const slug = slugProp ?? params.slug ?? '';
  const stub = Object.hasOwn(STUBS, slug) ? STUBS[slug] : undefined;

  if (!stub) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-title text-foreground">Page not found</h1>
          <p className="mt-4 text-lede text-muted-foreground">
            There is no page at this address. Try{' '}
            <Link to="/about" className="text-foreground underline underline-offset-4 hover:text-primary">
              what EventSphere does
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const product = stub.kind === 'product';

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-6 text-title text-foreground">{stub.title}</h1>

        <p className="mt-4 text-lede text-muted-foreground">{stub.summary}</p>

        <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-xs">
          {product ? (
            <>
              <h2 className="text-item text-card-foreground">This feature is built — this page isn&rsquo;t</h2>
              <p className="mt-2 text-body text-muted-foreground">
                {stub.title} is running inside the app right now; what has not been written is the marketing page
                describing it. Create an account and you will find it in your dashboard, or read{' '}
                <Link to="/about" className="text-foreground underline underline-offset-4 hover:text-primary">
                  how the pieces fit together
                </Link>
                .
              </p>
              <Button asChild className="mt-5">
                <Link to="/register">Create an account</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-item text-card-foreground">This page is a placeholder</h2>
              <p className="mt-2 text-body text-muted-foreground">
                EventSphere Management is an academic project. Publishing a real {stub.title.toLowerCase()} would
                mean asserting terms that this build cannot stand behind, so the document has deliberately been left
                unwritten.
              </p>
              <p className="mt-3 text-body text-muted-foreground">
                The data-handling behaviour it <em>would</em> describe is real and implemented: consent is captured
                at signup, and every signed-in account can export or delete its own data from{' '}
                <Link
                  to="/settings/privacy"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  privacy settings
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
