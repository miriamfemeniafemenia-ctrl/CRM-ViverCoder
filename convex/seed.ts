import { createAccount } from "@convex-dev/auth/server";
import { internalAction } from "./_generated/server";

type SeedAccount = {
  name: string;
  email: string | undefined;
  password: string | undefined;
  role: "owner" | "agent";
};

// Aprovisiona las 3 cuentas fijas (Miriam, Mónica, Antonio) para ARC-7.
// No expuesta al cliente (internalAction): solo se puede ejecutar vía
// `npx convex run seed:default`, nunca desde la app.
//
// `createAccount` no pasa por el `profile`/`authorize` del provider Password
// (verificado en @convex-dev/auth@0.0.94), así que el guard anti-signUp de
// convex/auth.ts no bloquea este camino.
export default internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts: SeedAccount[] = [
      {
        name: "Miriam",
        email: process.env.SEED_MIRIAM_EMAIL,
        password: process.env.SEED_MIRIAM_PASSWORD,
        role: "owner",
      },
      {
        name: "Mónica",
        email: process.env.SEED_MONICA_EMAIL,
        password: process.env.SEED_MONICA_PASSWORD,
        role: "agent",
      },
      {
        name: "Antonio",
        email: process.env.SEED_ANTONIO_EMAIL,
        password: process.env.SEED_ANTONIO_PASSWORD,
        role: "agent",
      },
    ];

    for (const { name, email, password, role } of accounts) {
      if (!email || !password) {
        throw new Error(
          `Faltan variables de entorno para sembrar la cuenta de ${name}. ` +
            `Ejecuta \`npx convex env set SEED_${name.toUpperCase()}_EMAIL ...\` y ` +
            `\`npx convex env set SEED_${name.toUpperCase()}_PASSWORD ...\` antes de correr este seed.`,
        );
      }
      const normalizedEmail = email.trim().toLowerCase();
      await createAccount(ctx, {
        provider: "password",
        account: { id: normalizedEmail, secret: password },
        profile: { name, email: normalizedEmail, role },
      });
    }
  },
});
