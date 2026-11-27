import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { pendingTasksLabel } from "@/lib/reminders";
import { setQuery } from "@/test/convex-mock";
import { MainNav } from "./main-nav";

// Navegación principal (ARC-79): nombre «Tareas de hoy», insignia sin cambios y
// clases que dejan encoger las pestañas del móvil con «…». jsdom no calcula
// anchos: estas pruebas protegen la estructura; los anchos reales (320–390 px)
// se comprueban a mano en el navegador.

// Ruta actual que devuelve `usePathname`; se repone en cada prueba.
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

beforeEach(() => {
  pathname = "/";
  setQuery(api.users.current, { _id: "u1", name: "Mónica" });
});

const classes = (el: Element | null) => [...(el?.classList ?? [])];

const nav = () => screen.getByRole("navigation", { name: "Navegación principal" });

describe("MainNav (ARC-79)", () => {
  test("las cuatro entradas en orden, la primera «Tareas de hoy»", () => {
    setQuery(api.reminders.countDueByAssignee, 0);
    render(<MainNav />);
    const names = within(nav())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual([
      "Tareas de hoy",
      "Clientes",
      "Posibles clientes",
      "Siniestros",
    ]);
    expect(screen.queryByText(/Mis tareas de hoy/)).toBeNull();
  });

  test("la insignia de «Tareas de hoy» sigue igual", () => {
    setQuery(api.reminders.countDueByAssignee, 3);
    render(<MainNav />);
    // Nombre accesible exacto: el nombre visible más el texto para lectores.
    const link = within(nav()).getByRole("link", {
      name: `Tareas de hoy ${pendingTasksLabel(3)}`,
    });
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.textContent).toContain("3");
  });

  test("sin tareas pendientes no hay insignia", () => {
    setQuery(api.reminders.countDueByAssignee, 0);
    render(<MainNav />);
    const link = within(nav()).getByRole("link", { name: "Tareas de hoy" });
    expect(link.textContent).toBe("Tareas de hoy");
  });

  test("las pestañas pueden encoger y el nombre se acorta con «…»", () => {
    setQuery(api.reminders.countDueByAssignee, 0);
    render(<MainNav />);
    expect(classes(nav().querySelector("ul"))).toContain("min-w-0");
    for (const link of within(nav()).getAllByRole("link")) {
      expect(classes(link.closest("li"))).toEqual(
        expect.arrayContaining(["min-w-0", "flex-auto"]),
      );
      expect(classes(link)).toContain("min-w-0");
      // El nombre completo sigue en el DOM: los lectores de pantalla lo leen
      // entero aunque se vea acortado.
      const label = within(link).getByText(link.textContent ?? "");
      expect(classes(label)).toEqual(
        expect.arrayContaining([
          "max-w-full",
          "overflow-hidden",
          "text-ellipsis",
          "whitespace-nowrap",
        ]),
      );
    }
  });
});
