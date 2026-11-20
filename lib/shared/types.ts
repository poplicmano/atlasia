import type { JSONContent } from "@tiptap/core";

export type RichTextDoc = JSONContent;

export type UserDTO = {
  id: string;
  username: string;
  displayName: string;
  role: "admin";
};

export type SessionDTO = {
  user: UserDTO;
  csrfToken: string;
  expiresAt: string;
};

export type CategoryDTO = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  channelCount: number;
  createdAt: string;
};

export type ChannelDTO = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  webhookConfigured: boolean;
  enabled: boolean;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryWithChannelsDTO = CategoryDTO & {
  channels: ChannelDTO[];
};

export type DestinationsDTO = {
  categories: CategoryWithChannelsDTO[];
};

export type EmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

export type EmbedConfig = {
  enabled: boolean;
  title: string;
  description: string;
  color: string;
  url: string;
  footerText: string;
  imageUrl: string;
  thumbnailUrl: string;
  includeTimestamp: boolean;
  fields: EmbedField[];
};

export type AnnouncementStatus = "pending" | "published" | "failed";

export type AnnouncementListItem = {
  id: string;
  title: string;
  summary: string;
  channelId: string | null;
  channelName: string;
  categoryName: string | null;
  authorName: string;
  status: AnnouncementStatus;
  createdAt: string;
  publishedAt: string | null;
};

export type AnnouncementDetail = AnnouncementListItem & {
  contentJson: RichTextDoc;
  discordMarkdown: string;
  plainText: string;
  embed: EmbedConfig | null;
  errorMessage: string | null;
  discordMessageId: string | null;
};

export type AnnouncementListResponse = {
  items: AnnouncementListItem[];
  total: number;
};

export type OverviewDTO = {
  metrics: {
    totalSent: number;
    publishedThisMonth: number;
    activeChannels: number;
    configuredChannels: number;
    failedDeliveries: number;
    totalAnnouncements: number;
  };
  recent: AnnouncementListItem[];
  destinations: DestinationsDTO;
};

export function createEmptyDoc(): RichTextDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function createEmptyEmbed(): EmbedConfig {
  return {
    enabled: false,
    title: "",
    description: "",
    color: "#8f2634",
    url: "",
    footerText: "",
    imageUrl: "",
    thumbnailUrl: "",
    includeTimestamp: false,
    fields: []
  };
}

export const EMPTY_DOC = createEmptyDoc();
export const EMPTY_EMBED = createEmptyEmbed();
