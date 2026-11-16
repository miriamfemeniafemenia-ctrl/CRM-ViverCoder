// Pruebas de src/lib/client-form.ts (ARC-49/ARC-11/ARC-66): provincia por
// código postal, paso cliente ↔ formulario ↔ datos enviados, el reductor de la
// dirección (incluidas respuestas antiguas, idempotencia y valores manuales) y
// que las copias de la lógica del servidor coinciden con el original.
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  CLIENT_ERRORS,
  normalizePostalCode as serverNormalizePostalCode,
} from "../../convex/lib/clientInput";
import { ASSIGNABLE_AGENT_ERROR, NOT_AUTHENTICATED } from "../../convex/lib/team";
import {
  addressReducer,
  AddressState,
  clientToForm,
  clientVersion,
  currentNormalizedPostalCode,
  emptyClientForm,
  formToPayload,
  initialAddressState,
  KNOWN_SERVER_ERRORS,
  normalizePostalCode,
  PROVINCES,
  provinceFromPostalCode,
  provinceMismatch,
} from "./client-form";

describe("provincia por código postal", () => {
  test("los 52 prefijos tienen provincia", () => {
    for (let i = 1; i <= 52; i++) {
      const prefix = String(i).padStart(2, "0");
      expect(provinceFromPostalCode(`${prefix}001`)).toBe(PROVINCES[prefix]);
      expect(PROVINCES[prefix]).toBeTruthy();
    }
    expect(Object.keys(PROVINCES)).toHaveLength(52);
  });
  test("casos conocidos", () => {
    expect(provinceFromPostalCode("46001")).toBe("Valencia");
    expect(provinceFromPostalCode("03001")).toBe("Alicante");
    expect(provinceFromPostalCode("12001")).toBe("Castellón");
    expect(provinceFromPostalCode("07001")).toBe("Illes Balears");
    expect(provinceFromPostalCode("35001")).toBe("Las Palmas");
    expect(provinceFromPostalCode("38001")).toBe("Santa Cruz de Tenerife");
    expect(provinceFromPostalCode("51001")).toBe("Ceuta");
    expect(provinceFromPostalCode("52001")).toBe("Melilla");
    expect(provinceFromPostalCode(" 46 001 ")).toBe("Valencia");
  });
  test("prefijos y formatos no válidos", () => {
    for (const raw of ["00001", "53001", "99001", "4600", "46a01", ""]) {
      expect(provinceFromPostalCode(raw)).toBeNull();
    }
  });
});

describe("copias de la lógica del servidor", () => {
  test("normalizePostalCode coincide con convex/lib/clientInput.ts", () => {
    for (const raw of ["46001", " 46 001 ", "01001", "52999", "00001", "53001", "4600", "460011", "46a01", "46-001", ""]) {
      expect(normalizePostalCode(raw)).toBe(serverNormalizePostalCode(raw));
    }
  });
  test("KNOWN_SERVER_ERRORS contiene exactamente los mensajes del servidor", () => {
    expect(new Set(KNOWN_SERVER_ERRORS)).toEqual(
      new Set([...Object.values(CLIENT_ERRORS), ASSIGNABLE_AGENT_ERROR, NOT_AUTHENTICATED]),
    );
  });
});

const agent = "agente1" as Id<"users">;
const fullClient = {
  _id: "c1" as Id<"clients">,
  _creationTime: 1,
  name: "Ana",
  phone: "600123456",
  email: "ana@test.es",
  channel: "web",
  saleStatus: "interesado",
  priority: "media",
  createdAt: 100,
  updatedAt: 200,
  secondPhone: "611222333",
  whatsapp: "622333444",
  dni: "12345678Z",
  birthDate: "1980-05-17",
  sex: "mujer",
  language: "valenciano",
  address: {
    street: "Calle Colón",
    number: "10",
    floorDoor: "3ºB",
    postalCode: "46004",
    city: "Valencia",
    province: "Valencia",
  },
  referredBy: "Pepe",
  assignedAgentId: agent,
} satisfies Doc<"clients">;

describe("cliente ↔ formulario ↔ datos enviados", () => {
  test("ida y vuelta conserva todos los campos, incluido floorDoor", () => {
    const payload = formToPayload(clientToForm(fullClient), initialAddressState(fullClient.address));
    expect(payload).toEqual({
      name: "Ana",
      phone: "600123456",
      email: "ana@test.es",
      channel: "web",
      secondPhone: "611222333",
      whatsapp: "622333444",
      dni: "12345678Z",
      birthDate: "1980-05-17",
      sex: "mujer",
      language: "valenciano",
      address: fullClient.address,
      referredBy: "Pepe",
      assignedAgentId: agent,
    });
  });
  test("vacíos → undefined y dirección vacía → sin dirección", () => {
    const payload = formToPayload({ ...emptyClientForm(), name: " Ana ", phone: " 600 " }, initialAddressState());
    expect(payload).toEqual({
      name: "Ana",
      phone: "600",
      email: undefined,
      channel: "llamada",
      secondPhone: undefined,
      whatsapp: undefined,
      dni: undefined,
      birthDate: undefined,
      sex: undefined,
      language: undefined,
      address: undefined,
      referredBy: undefined,
      assignedAgentId: undefined,
    });
  });
  test("dirección parcial: solo floorDoor; código válido normalizado; inválido tal cual", () => {
    const base = emptyClientForm();
    expect(formToPayload(base, { ...initialAddressState(), floorDoor: " Bajo " }).address).toEqual({
      street: undefined,
      number: undefined,
      floorDoor: "Bajo",
      postalCode: undefined,
      city: undefined,
      province: undefined,
    });
    expect(formToPayload(base, { ...initialAddressState(), postalCode: " 46 001 " }).address?.postalCode).toBe("46001");
    expect(formToPayload(base, { ...initialAddressState(), postalCode: "4600" }).address?.postalCode).toBe("4600");
  });
  test("versión: updatedAt, o createdAt en clientes antiguos", () => {
    expect(clientVersion(fullClient)).toBe(200);
    expect(clientVersion({ createdAt: 100, updatedAt: undefined })).toBe(100);
  });
});

const reduce = (state: AddressState, ...actions: Parameters<typeof addressReducer>[1][]) =>
  actions.reduce(addressReducer, state);
const typed = (state: AddressState, value: string) => addressReducer(state, { type: "postalCodeChanged", value });

describe("reductor de la dirección", () => {
  test("provincia en auto sigue al código; código inválido o incompleto la vacía", () => {
    let s = typed(initialAddressState(), "46001");
    expect(s.province).toBe("Valencia");
    s = typed(s, "4600");
    expect(s.province).toBe("");
    s = typed(s, "28001");
    expect(s.province).toBe("Madrid");
    for (const raw of ["53001", "46a01"]) expect(typed(s, raw).province).toBe("");
  });

  test("provincia editada a mano se conserva al cambiar el código, con aviso y «Usar…»", () => {
    let s = reduce(initialAddressState(), { type: "postalCodeChanged", value: "46001" }, { type: "provinceEdited", value: "Valéncia" });
    expect(s.provinceSource).toBe("manual");
    expect(provinceMismatch(s)).toBeNull(); // misma provincia sin acentos
    s = typed(s, "28001");
    expect(s.province).toBe("Valéncia"); // nunca se reescribe
    expect(provinceMismatch(s)).toBe("Madrid");
    s = addressReducer(s, { type: "useExpectedProvince" });
    expect(s).toMatchObject({ province: "Madrid", provinceSource: "auto" });
    expect(provinceMismatch(s)).toBeNull();
  });

  test("provincia borrada a mano: cuenta como manual y sigue vacía al cambiar el código, con aviso", () => {
    let s = reduce(initialAddressState(), { type: "postalCodeChanged", value: "46001" }, { type: "provinceEdited", value: "" });
    s = typed(s, "28001");
    expect(s).toMatchObject({ province: "", provinceSource: "manual" });
    expect(provinceMismatch(s)).toBe("Madrid");
  });

  test("respuesta tardía de un código anterior (46001 → 28001) se ignora", () => {
    let s = typed(initialAddressState(), "46001");
    s = typed(s, "28001");
    const late = addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] });
    expect(late).toBe(s);
    expect(late.city).toBe("");
  });

  test("código reutilizado (46001 → 28001 → 46001): se vuelve a proponer la población", () => {
    let s = typed(initialAddressState(), "46001");
    s = addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] });
    expect(s.city).toBe("Valencia");
    s = typed(s, "28001");
    expect(s.city).toBe(""); // la puso la app y era del código anterior
    s = typed(s, "46001");
    s = addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] });
    expect(s.city).toBe("Valencia");
  });

  test("espacios en el código: la respuesta normalizada se aplica", () => {
    for (const raw of ["46 001", " 46001 "]) {
      const s = typed(initialAddressState(), raw);
      expect(currentNormalizedPostalCode(s)).toBe("46001");
      expect(addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] }).city).toBe("Valencia");
    }
    // Teclear un espacio no cambia el código normalizado: la población puesta por la app se queda.
    let s = typed(initialAddressState(), "46001");
    s = addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] });
    expect(typed(s, "46 001").city).toBe("Valencia");
  });

  test("código inválido o incompleto: toda respuesta se ignora", () => {
    for (const raw of ["4600", "53001", "46a01"]) {
      const s = typed(initialAddressState(), raw);
      expect(addressReducer(s, { type: "citiesLoaded", postalCode: raw, cities: ["X"] })).toBe(s);
      expect(addressReducer(s, { type: "citiesLoaded", postalCode: null, cities: [] })).toBe(s);
    }
  });

  test("una población escrita a mano no se pisa nunca", () => {
    let s = reduce(initialAddressState(), { type: "postalCodeChanged", value: "46001" }, { type: "cityEdited", value: "Mi pueblo" });
    expect(addressReducer(s, { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] })).toBe(s);
    s = typed(s, "28001");
    expect(s.city).toBe("Mi pueblo");
    // Borrarla también es manual: no se vuelve a rellenar.
    s = addressReducer(s, { type: "cityEdited", value: "" });
    expect(addressReducer(s, { type: "citiesLoaded", postalCode: "28001", cities: ["Madrid"] })).toBe(s);
  });

  test("idempotencia: mismo objeto con respuesta repetida, ignorada, población manual o varias poblaciones", () => {
    let s = typed(initialAddressState(), "46001");
    const action = { type: "citiesLoaded", postalCode: "46001", cities: ["Valencia"] } as const;
    s = addressReducer(s, action);
    expect(addressReducer(s, action)).toBe(s);
    const varias = typed(initialAddressState(), "46001");
    expect(addressReducer(varias, { type: "citiesLoaded", postalCode: "46001", cities: ["A", "B"] })).toBe(varias);
    const ninguna = typed(initialAddressState(), "46001");
    expect(addressReducer(ninguna, { type: "citiesLoaded", postalCode: "46001", cities: [] })).toBe(ninguna);
    const auto = addressReducer(typed(initialAddressState(), "46001"), { type: "useExpectedProvince" });
    expect(addressReducer(auto, { type: "useExpectedProvince" })).toBe(auto);
  });

  test("estado inicial en edición: provincia coincidente (auto) o discrepante (manual)", () => {
    const coincide = initialAddressState({ postalCode: "46004", province: "valencia", city: "Valencia" });
    expect(coincide).toMatchObject({ provinceSource: "auto", citySource: "manual" });
    const discrepa = initialAddressState({ postalCode: "46004", province: "Madrid" });
    expect(discrepa).toMatchObject({ provinceSource: "manual", citySource: "auto" });
    expect(provinceMismatch(discrepa)).toBe("Valencia");
    expect(initialAddressState({ province: "Valencia" }).provinceSource).toBe("manual"); // sin código
    expect(initialAddressState().provinceSource).toBe("auto");
  });
});
