"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { getEditorExtensions } from "@/lib/rich-text";
import type { RichTextDoc } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

export function RichTextViewer({ doc, className }: { doc: RichTextDoc; className?: string }) {
  const editor = useEditor({
    extensions: getEditorExtensions(true),
    content: doc,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "focus:outline-none" }
    }
  });

  React.useEffect(() => {
    editor?.setEditable(false);
  }, [editor]);

  React.useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(doc);
    if (current !== incoming) {
      editor.commands.setContent(doc, false);
    }
  }, [editor, doc]);

  return (
    <div className={cn("rich-content viewer-content", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
