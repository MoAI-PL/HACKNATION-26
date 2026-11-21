// Tymczasowa treść ekranu roli (Z04) – zastąpią ją właściwe ekrany (Z11 pulpit, Z18 panel HR itd.).
// Renderowana wewnątrz AppShell (Z10), który dostarcza <main>.
import { PageHeader } from "@/components/layout/AppShell";

export function RolePlaceholder({ title, children }: { title: string; children: React.ReactNode }) {
  return <PageHeader title={title} description={children} />;
}
