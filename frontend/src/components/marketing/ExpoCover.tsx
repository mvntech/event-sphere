import { Duotone } from '@/components/marketing/Duotone';

const COVERS: Record<string, string> = {
  sustainability: '/covers/sustainability.svg',
  'applied technology': '/covers/applied-technology.svg',
  'food & drink': '/covers/food-drink.svg',
  games: '/covers/games.svg',
};

export function coverFor(theme?: string | null) {
  return COVERS[(theme ?? '').trim().toLowerCase()] ?? '/covers/default.svg';
}

export function ExpoCover({
  theme,
  className,
}: {
  theme?: string | null;
  className?: string;
}) {
  return <Duotone src={coverFor(theme)} className={className} />;
}
