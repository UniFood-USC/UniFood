import { calcularProximaApertura, estaAbierto } from "../utils/horario";
import { Horario } from "../types/restaurante";

const tramo = { abre: "08:00", cierra: "18:00" };
const horario: Horario = {
  lunes: tramo, martes: tramo, miercoles: tramo, jueves: tramo, viernes: tramo,
  sabado: null, domingo: null,
};

// Hora del campus = UTC-5
const lunes10am  = new Date("2026-10-05T15:00:00Z"); // lunes 10:00
const lunes6am   = new Date("2026-10-05T11:00:00Z"); // lunes 06:00
const lunes6pm   = new Date("2026-10-05T23:00:00Z"); // lunes 18:00 exacto
const lunes8pm   = new Date("2026-10-06T01:00:00Z"); // lunes 20:00
const viernes8pm = new Date("2026-10-10T01:00:00Z"); // viernes 20:00
const sabado10am = new Date("2026-10-10T15:00:00Z"); // sábado 10:00

describe("estaAbierto", () => {
  it("abierto dentro del horario", () => expect(estaAbierto(horario, lunes10am)).toBe(true));
  it("cerrado antes de abrir", () => expect(estaAbierto(horario, lunes6am)).toBe(false));
  it("cerrado a la hora exacta de cierre", () => expect(estaAbierto(horario, lunes6pm)).toBe(false));
  it("cerrado en día sin atención", () => expect(estaAbierto(horario, sabado10am)).toBe(false));
  it("sin horario => cerrado", () => expect(estaAbierto(undefined, lunes10am)).toBe(false));
});

describe("calcularProximaApertura", () => {
  it("hoy si aún no abre", () => expect(calcularProximaApertura(horario, lunes6am)).toBe("Hoy 08:00"));
  it("mañana si ya cerró", () => expect(calcularProximaApertura(horario, lunes8pm)).toBe("Mañana 08:00"));
  it("salta el fin de semana", () => expect(calcularProximaApertura(horario, viernes8pm)).toBe("Lunes 08:00"));
  it("sin horario => undefined", () => expect(calcularProximaApertura(undefined)).toBeUndefined());
});
