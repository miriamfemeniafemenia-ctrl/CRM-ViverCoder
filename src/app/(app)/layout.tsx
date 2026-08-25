import { MainNav } from "@/components/main-nav";

// Layout compartido por todas las pantallas autenticadas (ARC-8). /login
// vive fuera de este route group, así que nunca lleva nav.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MainNav />
      <main className="flex min-h-full flex-1 flex-col pt-[var(--header-height)] pb-[calc(var(--bottom-nav-height)+var(--safe-bottom))] md:pt-0 md:pb-0 md:pl-[var(--side-nav-width)]">
        {children}
      </main>
    </div>
  );
}
