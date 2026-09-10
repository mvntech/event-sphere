import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useExpos } from '@/hooks/useExpos';
import type { Expo } from '@/types';

interface Props {
  value: string;
  onChange: (expoId: string) => void;
  label?: string;
}

export function ExpoPicker({ value, onChange, label = 'Expo' }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending } = useExpos({ mine: true, limit: 50 });

  const expos: Expo[] = data?.items ?? [];

  useEffect(() => {
    if (isPending || expos.length === 0) return;

    const fromUrl = searchParams.get('expo');
    const valid = fromUrl && expos.some((e) => e.id === fromUrl) ? fromUrl : null;

    if (!value) onChange(valid ?? expos[0].id);
    else if (!expos.some((e) => e.id === value)) onChange(expos[0].id);
  }, [isPending, expos, value, onChange, searchParams]);

  const handleChange = (next: string) => {
    onChange(next);
    const params = new URLSearchParams(searchParams);
    params.set('expo', next);
    setSearchParams(params, { replace: true });
  };

  if (isPending) return <Skeleton className="h-11 w-full sm:w-72" />;
  if (expos.length === 0) return null;

  return (
    <div className="grid w-full gap-2 sm:w-72">
      <Label htmlFor="expo-picker">{label}</Label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger id="expo-picker">
          <SelectValue placeholder="Choose an expo" />
        </SelectTrigger>
        <SelectContent>
          {expos.map((expo) => (
            <SelectItem key={expo.id} value={expo.id}>
              {expo.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
