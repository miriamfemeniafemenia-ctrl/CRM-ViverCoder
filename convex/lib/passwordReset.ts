// Lógica del restablecimiento de contraseña (ARC-75), separada de Convex para
// poder probar los fallos parciales con dependencias simuladas. La cablea
// convex/adminAuth.ts.
//
// Orden y garantías (ver el plan de ARC-75):
// - Antes de cambiar nada, cualquier fallo (cuenta no permitida, contraseña
//   ausente, cuenta inexistente, no poder abrir la auditoría) aborta sin tocar datos.
// - Tras cambiar la contraseña la invalidación de sesiones es obligatoria: un fallo
//   de auditoría nunca la interrumpe (cada escritura va en su propio try/catch).
// - Nunca se afirma lo que no se puede demostrar: solo `completado` dice que
//   sesiones y refresh tokens quedaron a 0; nada «repara» registros ambiguos.
// - La contraseña nunca sale de aquí: ni en logs, ni en errores, ni en el resultado.
// - No se revoca de forma inmediata una conexión ya autenticada: su JWT de acceso
//   sigue valiendo hasta caducar (1 h por defecto en @convex-dev/auth).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_INVALIDATION_ATTEMPTS = 3;

export type AuditStatus =
  | "fallo_cambio"
  | "contrasena_cambiada"
  | "completado"
  | "fallo_invalidacion";

export type AuditPatch = {
  status: AuditStatus;
  finishedAt?: number;
  sessionsInvalidated?: number;
  sessionsRemaining?: number;
};

export type SessionState = {
  sessionIds: string[];
  sessions: number;
  refreshTokens: number;
};

export type ResetDeps = {
  allowedEmails(): string[];
  readPassword(): string | undefined;
  findUserId(email: string): Promise<string | null>;
  newRequestId(): string;
  openAudit(requestId: string, userId: string): Promise<unknown>;
  updateAudit(requestId: string, patch: AuditPatch): Promise<unknown>;
  sessionState(userId: string, knownSessionIds: string[]): Promise<SessionState>;
  modifyPassword(email: string, password: string): Promise<void>;
  invalidateSessions(userId: string): Promise<void>;
  superseder(requestId: string): Promise<number>;
  now(): number;
  log(message: string): void;
};

export type ResetResult = {
  ok: true;
  requestId: string;
  // B: el reset es seguro pero la auditoría no pudo cerrarse como `completado`.
  auditoriaPendiente?: true;
  // A con fallo al supersedar: el reset no se degrada, el historial previo sigue pendiente.
  historialPrevioPendiente?: true;
  registrosSupersedidos?: number;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function runReset(deps: ResetDeps, rawEmail: string): Promise<ResetResult> {
  const email = normalizeEmail(rawEmail);
  if (!deps.allowedEmails().includes(email)) {
    throw new Error("Esa cuenta no está permitida para restablecer la contraseña");
  }
  const password = deps.readPassword();
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `RESET_PASSWORD no está configurada o tiene menos de ${MIN_PASSWORD_LENGTH} caracteres`,
    );
  }
  const userId = await deps.findUserId(email);
  if (userId === null) {
    throw new Error("No existe una cuenta con ese email");
  }

  const requestId = deps.newRequestId();
  // Único punto en que un fallo de auditoría detiene la operación, y es antes de
  // cambiar nada.
  await deps.openAudit(requestId, userId);

  // Mejor esfuerzo: un fallo aquí no puede impedir la invalidación.
  const tryAudit = async (patch: AuditPatch) => {
    try {
      await deps.updateAudit(requestId, patch);
      return true;
    } catch {
      return false;
    }
  };

  const seen = new Set<string>();
  try {
    const before = await deps.sessionState(userId, []);
    before.sessionIds.forEach((id) => seen.add(id));
    await deps.modifyPassword(email, password);
  } catch {
    await tryAudit({ status: "fallo_cambio", finishedAt: deps.now() });
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=fallo_cambio`);
    throw new Error(`No se ha cambiado la contraseña (requestId ${requestId})`);
  }

  // Desde aquí la invalidación es obligatoria.
  await tryAudit({ status: "contrasena_cambiada" });

  let remaining: { sessions: number; refreshTokens: number } | null = null;
  for (let attempt = 1; attempt <= MAX_INVALIDATION_ATTEMPTS; attempt++) {
    try {
      await deps.invalidateSessions(userId);
    } catch {
      // Se sigue: el recuento de abajo es la prueba, no la ausencia de error.
    }
    try {
      const state = await deps.sessionState(userId, [...seen]);
      state.sessionIds.forEach((id) => seen.add(id));
      remaining = { sessions: state.sessions, refreshTokens: state.refreshTokens };
    } catch {
      remaining = null;
    }
    if (remaining !== null && remaining.sessions === 0 && remaining.refreshTokens === 0) break;
  }

  if (remaining === null || remaining.sessions !== 0 || remaining.refreshTokens !== 0) {
    await tryAudit({
      status: "fallo_invalidacion",
      finishedAt: deps.now(),
      sessionsInvalidated: seen.size,
      ...(remaining ? { sessionsRemaining: remaining.sessions + remaining.refreshTokens } : {}),
    });
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=C`);
    throw new Error(
      `CONTRASEÑA CAMBIADA pero las sesiones NO se han invalidado: vuelve a ejecutar (requestId ${requestId})`,
    );
  }

  const closed = await tryAudit({
    status: "completado",
    finishedAt: deps.now(),
    sessionsInvalidated: seen.size,
    sessionsRemaining: 0,
  });
  if (!closed) {
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=B`);
    return { ok: true, requestId, auditoriaPendiente: true };
  }

  // Resultado A. La supersesión de registros previos va en una mutation posterior
  // y su fallo no degrada el reset.
  try {
    const registrosSupersedidos = await deps.superseder(requestId);
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=A`);
    return { ok: true, requestId, registrosSupersedidos };
  } catch {
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=A historialPrevioPendiente`);
    return { ok: true, requestId, historialPrevioPendiente: true };
  }
}
