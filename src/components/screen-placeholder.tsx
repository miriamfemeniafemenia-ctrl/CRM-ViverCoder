/**
 * Temporary stand-in so every route in the PRD's routing map (ARC-8) resolves
 * to something before the real screen is built. Delete this import/usage from
 * a page as soon as its real UI (ported from the Oficina de Valencia design
 * system) replaces it.
 */
export function ScreenPlaceholder({
  screen,
  functions,
  ticket,
  children,
}: {
  screen: string;
  functions: string;
  ticket?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col gap-2 p-6">
      <p className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
        {functions}
        {ticket ? ` · ${ticket}` : ""}
      </p>
      <h1 className="text-2xl font-semibold text-text-primary">{screen}</h1>
      <p className="text-sm text-text-secondary">
        Pantalla pendiente de construir contra el design system Oficina de
        Valencia.
      </p>
      {children}
    </div>
  );
}
