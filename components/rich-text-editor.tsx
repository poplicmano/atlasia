"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getEditorExtensions } from "@/lib/rich-text";
import { isSafeLinkHref } from "@/lib/shared/schemas";
import type { RichTextDoc } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: RichTextDoc;
  onChange: (value: RichTextDoc) => void;
  disabled?: boolean;
};

type ToolButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 text-ink-subtle hover:text-ink",
        active && "border border-accent-border bg-accent-soft text-[#d9a0aa] hover:text-[#d9a0aa]"
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-surface-border" aria-hidden="true" />;
}

export function RichTextEditor({ value, onChange, disabled = false }: RichTextEditorProps) {
  const onChangeRef = React.useRef(onChange);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkError, setLinkError] = React.useState("");
  const [hasExistingLink, setHasExistingLink] = React.useState(false);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: getEditorExtensions(false),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        spellcheck: "true"
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current(currentEditor.getJSON() as RichTextDoc);
    }
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current !== incoming) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const openLinkDialog = () => {
    if (!editor) return;
    const href = editor.isActive("link") ? String(editor.getAttributes("link").href ?? "") : "";
    setHasExistingLink(Boolean(href));
    setLinkUrl(href);
    setLinkError("");
    setLinkOpen(true);
  };

  const applyLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const href = linkUrl.trim();
    if (!isSafeLinkHref(href)) {
      setLinkError("Use a valid http, https, or mailto URL.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const unavailable = !editor || disabled;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-raised/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-surface-border bg-surface/80 p-2">
        <ToolButton label="Bold" active={editor?.isActive("bold")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Italic" active={editor?.isActive("italic")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Underline" active={editor?.isActive("underline")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Strikethrough" active={editor?.isActive("strike")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolbarDivider />
        <ToolButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} disabled={unavailable} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} disabled={unavailable} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Heading 3" active={editor?.isActive("heading", { level: 3 })} disabled={unavailable} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolButton>
        <ToolbarDivider />
        <ToolButton label="Bullet list" active={editor?.isActive("bulletList")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor?.isActive("orderedList")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Quote" active={editor?.isActive("blockquote")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Code block" active={editor?.isActive("codeBlock")} disabled={unavailable} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Code2 className="h-4 w-4" />
        </ToolButton>
        <ToolbarDivider />
        <ToolButton label="Hyperlink" active={editor?.isActive("link")} disabled={unavailable} onClick={openLinkDialog}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Undo" disabled={unavailable} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" disabled={unavailable} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="rich-content editor-content">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface/80 px-4 py-2 text-[0.7rem] text-ink-subtle">
        <span>Discord-compatible Markdown is generated securely at publish time.</span>
        <span className="hidden sm:inline">TipTap editor</span>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add hyperlink</DialogTitle>
            <DialogDescription>Links are validated and converted to Discord Markdown.</DialogDescription>
          </DialogHeader>
          <form onSubmit={applyLink}>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://example.com/announcement"
                  value={linkUrl}
                  onChange={(event) => {
                    setLinkUrl(event.target.value);
                    setLinkError("");
                  }}
                  autoFocus
                />
              </div>
              {linkError && <p className="text-sm text-red-300">{linkError}</p>}
              <p className="text-xs leading-5 text-ink-subtle">Select text in the editor first, then apply the link. http, https, and mailto URLs are allowed.</p>
            </div>
            <DialogFooter>
              {hasExistingLink && (
                <Button type="button" variant="danger" onClick={removeLink}>
                  <Unlink className="h-4 w-4" /> Remove link
                </Button>
              )}
              <Button type="submit" variant="accent">Apply link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
