// Tymczasowa treść ekranu roli (Z04) – zastąpią ją właściwe ekrany (Z11 pulpit, Z18 panel HR itd.).
export function RolePlaceholder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{children}</p>
    </main>
  );
}
