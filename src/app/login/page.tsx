"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

// Login — Acceso. Email + contraseña para una de las 3 cuentas fijas
// (Miriam/Mónica/Antonio). Sin registro público (ARC-7). Portado 1:1 del
// mockup Login.dc.html del handoff de diseño.
export default function Page() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [forgotOpen, setForgotOpen] = useState(false);

  const isLoading = status === "loading";
  const isError = status === "error";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || !email.trim() || !password) return;
    setStatus("loading");
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: "signIn",
      });
      router.push("/");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-surface-app p-4">
      <div className="w-full max-w-sm rounded-lg border border-border-default bg-surface-card p-8 shadow-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-500 text-lg font-bold text-on-brand">
            A
          </div>
          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-lg font-bold text-text-primary">
              Arco Seguros
            </span>
            <span className="text-sm text-text-tertiary">
              CRM · Inicia sesión para continuar
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (isError) setStatus("idle");
              }}
              placeholder="tu@arcoseguros.es"
              disabled={isLoading}
              className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (isError) setStatus("idle");
                }}
                placeholder="Tu contraseña"
                disabled={isLoading}
                className="h-12 w-full rounded-md border border-border-default px-3 pr-11 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label="Mostrar u ocultar contraseña"
                className="absolute top-0 right-0 flex h-12 w-11 items-center justify-center text-text-tertiary"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </label>

          {isError && (
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg px-4 py-3">
              <span className="text-warning-fg">⚠</span>
              <span className="text-sm text-warning-fg">
                Email o contraseña incorrectos. Inténtalo de nuevo.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-500 font-medium text-on-brand disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                Accediendo…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setForgotOpen((value) => !value)}
              className="text-sm text-text-link"
            >
              ¿Olvidaste tu contraseña?
            </button>
            {forgotOpen && (
              <p className="max-w-[280px] text-center text-xs text-text-tertiary">
                Contacta con Miriam para restablecerla — no hay recuperación
                automática con solo 3 cuentas.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
