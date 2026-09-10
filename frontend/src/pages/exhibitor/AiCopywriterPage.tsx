import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiSourceNotice } from '@/components/ai/AiSourceNotice';
import { useAiDescription } from '@/hooks/useAi';
import { useMyApplications, useUpdateExhibitorProfile } from '@/hooks/useExhibitors';
import { ApiError } from '@/lib/api';

export default function AiCopywriterPage() {
  const applications = useMyApplications();
  const generate = useAiDescription();
  const updateProfile = useUpdateExhibitorProfile();

  const profiles = applications.data?.items ?? [];
  const [profileId, setProfileId] = useState('');
  const [points, setPoints] = useState<string[]>(['']);
  const [copied, setCopied] = useState(false);

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0];

  const setPoint = (index: number, value: string) =>
    setPoints((current) => current.map((p, i) => (i === index ? value : p)));

  const filled = points.map((p) => p.trim()).filter(Boolean);

  const run = () => {
    if (filled.length === 0) return;
    generate.mutate(
      {
        bulletPoints: filled,
        companyName: activeProfile?.companyName,
        category: activeProfile?.category,
      },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not draft a description') }
    );
  };

  const copy = async () => {
    if (!generate.data?.description) return;
    try {
      await navigator.clipboard.writeText(generate.data.description);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };

  const applyToProfile = async () => {
    if (!activeProfile || !generate.data?.description) return;
    try {
      await updateProfile.mutateAsync({ id: activeProfile.id, description: generate.data.description });
      toast.success('Profile description updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update your profile');
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="AI copywriter"
        description="Jot down rough notes about your company and it will turn them into profile copy you can edit and use."
      />

      <Card>
        <CardHeader>
          <CardTitle>Your notes</CardTitle>
          <CardDescription>
            Short fragments are fine — what you make, who it is for, what makes it worth a visit.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {profiles.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="copywriter-profile">Which company profile?</Label>
              <Select value={activeProfile?.id} onValueChange={setProfileId}>
                <SelectTrigger id="copywriter-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-body font-medium">Notes</legend>
            {points.map((point, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={point}
                  onChange={(e) => setPoint(index, e.target.value)}
                  maxLength={300}
                  placeholder={
                    index === 0 ? 'We build picking arms for mid-size warehouses' : 'Another note…'
                  }
                  aria-label={`Note ${index + 1}`}
                />
                {points.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setPoints((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove note ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={points.length >= 15}
              onClick={() => setPoints((current) => [...current, ''])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add note
            </Button>
          </fieldset>

          <Button onClick={run} loading={generate.isPending} disabled={filled.length === 0}>
            <Wand2 className="size-4" aria-hidden="true" />
            Write my description
          </Button>
        </CardContent>
      </Card>

      {generate.data && !generate.isPending && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                Draft
              </CardTitle>
              <CardDescription>Edit it however you like before using it.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <AiSourceNotice
                source={generate.data.source}
                reason={generate.data.reason}
                fallbackMethod="a tidied-up version of your own notes"
              />
              
              {generate.data.tagline && (
                <p className="border-l-2 border-primary/40 bg-accent px-4 py-3 text-body font-medium">
                  {generate.data.tagline}
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor="ai-draft">Description</Label>
                <Textarea
                  id="ai-draft"
                  value={generate.data.description}
                  rows={5}
                  readOnly
                  className="bg-muted/50"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? (
                    <>
                      <Check className="size-4" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </Button>

                {activeProfile && (
                  <Button size="sm" onClick={applyToProfile} loading={updateProfile.isPending}>
                    Use on my profile
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={run} loading={generate.isPending}>
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
