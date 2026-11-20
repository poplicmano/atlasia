import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { isSafeLinkHref } from "@/lib/shared/schemas";

export function getEditorExtensions(viewer = false) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] }
    }),
    Underline,
    Link.configure({
      openOnClick: viewer,
      autolink: !viewer,
      linkOnPaste: !viewer,
      validate: (href: string) => isSafeLinkHref(href),
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        class: "atlasia-link"
      }
    }),
    ...(viewer
      ? []
      : [
          Placeholder.configure({
            placeholder: "Write the announcement body. Use the toolbar for Discord-compatible formatting…",
            showOnlyWhenEditable: true,
            showOnlyCurrent: false
          })
        ])
  ];
}
