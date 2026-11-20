"use client";

import * as React from "react";
import { Layers3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EmbedConfig, EmbedField } from "@/lib/shared/types";

type EmbedEditorProps = {
  value: EmbedConfig;
  onChange: (value: EmbedConfig) => void;
};

function validColor(value: string): string {
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : "#8f2634";
}

export function EmbedEditor({ value, onChange }: EmbedEditorProps) {
  const patch = (changes: Partial<EmbedConfig>) => onChange({ ...value, ...changes });

  const updateField = (index: number, changes: Partial<EmbedField>) => {
    const fields = value.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...changes } : field));
    patch({ fields });
  };

  const addField = () => {
    if (value.fields.length >= 25) return;
    patch({ fields: [...value.fields, { name: "", value: "", inline: false }] });
  };

  const removeField = (index: number) => {
    patch({ fields: value.fields.filter((_, fieldIndex) => fieldIndex !== index) });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[#b65b68]" /> Optional Discord embed
          </CardTitle>
          <CardDescription className="mt-1">Add a structured card beneath the message. Empty fields fall back to the announcement title and description.</CardDescription>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-label="Enable embed" />
      </CardHeader>

      {value.enabled && (
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="embed-title">Embed title</Label>
              <Input
                id="embed-title"
                placeholder="Defaults to announcement title"
                value={value.title}
                maxLength={256}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embed-url">Title URL</Label>
              <Input
                id="embed-url"
                type="url"
                placeholder="https://example.com"
                value={value.url}
                onChange={(event) => patch({ url: event.target.value })}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="embed-description">Embed description</Label>
            <Textarea
              id="embed-description"
              className="min-h-[90px] resize-y"
              placeholder="Defaults to the short description or announcement body."
              value={value.description}
              maxLength={4096}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="embed-color">Accent color</Label>
              <div className="flex gap-2">
                <input
                  id="embed-color-picker"
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-lg"
                  value={validColor(value.color)}
                  onChange={(event) => patch({ color: event.target.value })}
                  aria-label="Choose embed color"
                />
                <Input
                  id="embed-color"
                  value={value.color}
                  maxLength={7}
                  onChange={(event) => patch({ color: event.target.value })}
                  placeholder="#8f2634"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="embed-footer">Footer text</Label>
              <Input
                id="embed-footer"
                placeholder="ATLASIA"
                value={value.footerText}
                maxLength={2048}
                onChange={(event) => patch({ footerText: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="embed-image">Image URL</Label>
              <Input
                id="embed-image"
                type="url"
                placeholder="https://example.com/image.png"
                value={value.imageUrl}
                onChange={(event) => patch({ imageUrl: event.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embed-thumbnail">Thumbnail URL</Label>
              <Input
                id="embed-thumbnail"
                type="url"
                placeholder="https://example.com/thumbnail.png"
                value={value.thumbnailUrl}
                onChange={(event) => patch({ thumbnailUrl: event.target.value })}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-background/50 p-3">
            <div>
              <div className="text-sm font-medium text-ink">Include Discord timestamp</div>
              <div className="text-xs text-ink-subtle">Adds the publication time to the embed footer.</div>
            </div>
            <Switch
              checked={value.includeTimestamp}
              onCheckedChange={(includeTimestamp) => patch({ includeTimestamp })}
              aria-label="Include timestamp"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Embed fields</Label>
                <p className="mt-1 text-xs text-ink-subtle">Up to 25 fields. Inline fields are arranged in two columns.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addField} disabled={value.fields.length >= 25}>
                <Plus className="h-4 w-4" /> Add field
              </Button>
            </div>

            {value.fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-background/40 px-4 py-6 text-center text-sm text-ink-subtle">
                No embed fields configured.
              </div>
            ) : (
              <div className="space-y-3">
                {value.fields.map((field, index) => (
                  <div key={index} className="rounded-xl border border-surface-border bg-background/50 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Field name"
                        value={field.name}
                        maxLength={256}
                        onChange={(event) => updateField(index, { name: event.target.value })}
                        aria-label={`Field ${index + 1} name`}
                      />
                      <Input
                        placeholder="Field value"
                        value={field.value}
                        maxLength={1024}
                        onChange={(event) => updateField(index, { value: event.target.value })}
                        aria-label={`Field ${index + 1} value`}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-ink-muted">
                        <Switch
                          checked={field.inline}
                          onCheckedChange={(inline) => updateField(index, { inline })}
                          aria-label={`Field ${index + 1} inline`}
                        />
                        Inline
                      </label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeField(index)}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
