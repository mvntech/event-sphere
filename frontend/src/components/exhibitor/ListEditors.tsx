import { Package, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExhibitorProduct, ExhibitorStaff } from '@/types';

const MAX_ROWS = 25;

function SectionHeader({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="text-meta text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface ProductsProps {
  value: ExhibitorProduct[];
  onChange: (products: ExhibitorProduct[]) => void;
}

/** repeatable product/service rows — what the exhibitor is showing at the expo. */
export function ProductsEditor({ value, onChange }: ProductsProps) {
  const update = (index: number, patch: Partial<ExhibitorProduct>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Products and services</legend>
      <SectionHeader
        icon={Package}
        title="Products & services"
        description="What you are showing. Attendees search by these."
      />

      {value.map((product, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor={`product-name-${index}`} className="text-meta">
              Name
            </Label>
            <Input
              id={`product-name-${index}`}
              value={product.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Helix One picking arm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`product-category-${index}`} className="text-meta">
              Category
            </Label>
            <Input
              id={`product-category-${index}`}
              value={product.category}
              onChange={(e) => update(index, { category: e.target.value })}
              placeholder="Robotics"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove product ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= MAX_ROWS}
        onClick={() => onChange([...value, { name: '', category: '', description: '' }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add product
      </Button>
    </fieldset>
  );
}

interface StaffProps {
  value: ExhibitorStaff[];
  onChange: (staff: ExhibitorStaff[]) => void;
}

/** repeatable staff rows — who will be on the booth. */
export function StaffEditor({ value, onChange }: StaffProps) {
  const update = (index: number, patch: Partial<ExhibitorStaff>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Booth staff</legend>
      <SectionHeader icon={Users} title="Booth staff" description="Who will be on the stand during the expo." />

      {value.map((member, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor={`staff-name-${index}`} className="text-meta">
              Name
            </Label>
            <Input
              id={`staff-name-${index}`}
              value={member.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Sana Iqbal"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`staff-role-${index}`} className="text-meta">
              Role
            </Label>
            <Input
              id={`staff-role-${index}`}
              value={member.role ?? ''}
              onChange={(e) => update(index, { role: e.target.value })}
              placeholder="Head of Sales"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove staff member ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= MAX_ROWS}
        onClick={() => onChange([...value, { name: '', role: '', email: '' }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add staff member
      </Button>
    </fieldset>
  );
}

/** drops half-filled rows before submitting, so blanks never reach the API. */
export const cleanProducts = (products: ExhibitorProduct[]) =>
  products
    .map((p) => ({ ...p, name: p.name.trim(), category: p.category.trim() }))
    .filter((p) => p.name && p.category);

export const cleanStaff = (staff: ExhibitorStaff[]) =>
  staff.map((s) => ({ ...s, name: s.name.trim(), role: s.role?.trim() ?? '' })).filter((s) => s.name);
