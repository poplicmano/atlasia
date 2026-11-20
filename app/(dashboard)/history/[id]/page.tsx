import { AnnouncementDetailView } from "@/components/history/announcement-detail";

export const dynamic = "force-dynamic";

export default function AnnouncementPage({ params }: { params: { id: string } }) {
  return <AnnouncementDetailView id={params.id} />;
}
