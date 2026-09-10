import { describe, expect, it } from 'vitest';
import { cn } from './utils';

const STEPS = [
  'text-display',
  'text-title',
  'text-section',
  'text-item',
  'text-lede',
  'text-body',
  'text-meta',
  'text-stat',
] as const;

describe('cn — type scale registration', () => {
  it.each(STEPS)('keeps %s alongside a colour utility', (step) => {
    const out = cn(step, 'text-primary');
    expect(out).toContain(step);
    expect(out).toContain('text-primary');
  });

  it.each(STEPS)('keeps %s alongside a muted colour', (step) => {
    expect(cn(step, 'text-muted-foreground').split(' ')).toEqual([step, 'text-muted-foreground']);
  });

  it('still treats two steps as a genuine conflict', () => {
    expect(cn('text-body', 'text-section')).toBe('text-section');
    expect(cn('text-stat', 'text-meta')).toBe('text-meta');
  });

  it('resolves a conflict in favour of the last one, whatever the order', () => {
    expect(cn('text-meta', 'text-title')).toBe('text-title');
    expect(cn('text-title', 'text-meta')).toBe('text-meta');
  });

  it('does not confuse a step with a colour that shares its prefix', () => {
    const out = cn('text-item', 'text-foreground');
    expect(out).toContain('text-item');
    expect(out).toContain('text-foreground');
  });
});

describe('cn — ordinary merging still works', () => {
  it('resolves a real Tailwind conflict', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('rounded-lg', 'rounded-xl')).toBe('rounded-xl');
  });

  it('keeps utilities that do not conflict', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center');
  });

  it('skips falsy arguments', () => {
    expect(cn('flex', false && 'hidden', undefined, null, '')).toBe('flex');
  });

  it('accepts conditional object and array forms', () => {
    expect(cn('flex', { hidden: false, 'gap-2': true }, ['p-4'])).toBe('flex gap-2 p-4');
  });

  it('lets a later conditional class win a conflict', () => {
    expect(cn('p-2', { 'p-6': true })).toBe('p-6');
  });
});
