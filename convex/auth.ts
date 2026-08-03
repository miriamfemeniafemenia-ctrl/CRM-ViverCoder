import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// 3 cuentas fijas (Miriam, Mónica, Antonio), sin auto-registro (ARC-7).
//
// El registro público se bloquea aquí, dentro del `profile` callback del
// provider Password, y no en un `callbacks.createOrUpdateUser` global:
// `createAccount` (usado por convex/seed.ts para aprovisionar las 3 cuentas)
// nunca pasa por `authorize`/`profile` de este provider, así que el seed no
// se autobloquea. Verificado leyendo @convex-dev/auth@0.0.94.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = (params.email as string).trim().toLowerCase();
        if (params.flow === "signUp") {
          throw new Error(
            "Registro no disponible. Contacta con Miriam para crear una cuenta.",
          );
        }
        // `name`/`role` solo importan para el flow "signUp", ya bloqueado
        // arriba, así que estos valores nunca se persisten de verdad.
        return { email, name: "", role: "agent" as const };
      },
    }),
  ],
});
