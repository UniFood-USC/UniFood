import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase"; // AJUSTAR: ruta real de tu config de Firebase
import { RestauranteDoc, RestaurantePublico } from "../types/restaurante";
import { calcularProximaApertura, estaAbierto } from "../utils/horario";

/**
 * RF-04: consulta pública de establecimientos.
 * - Solo aprobados y activos (pendientes, suspendidos y eliminados quedan fuera).
 * - Incluye los cerrados, con su próxima apertura.
 * - Solo devuelve campos públicos.
 * - Sin resultados => [] (la pantalla muestra el mensaje).
 */
export async function listarRestaurantes(
  ahora: Date = new Date()
): Promise<RestaurantePublico[]> {
  const q = query(
    collection(db, "restaurantes"),
    where("estado", "==", "aprobado"),
    where("activo", "==", true)
  );

  const snap = await getDocs(q);

  const lista: RestaurantePublico[] = [];
  snap.forEach((d) => {
    const r = d.data() as RestauranteDoc;
    if (!r.nombre) return; 

    const abierto = estaAbierto(r.horario, ahora);
    lista.push({
      id: d.id,
      nombre: r.nombre,
      logo: r.logo,
      disponible: abierto,
      proximaApertura: abierto
        ? undefined
        : calcularProximaApertura(r.horario, ahora),
    });
  });

  // Abiertos primero, luego por nombre
  return lista.sort((a, b) =>
    a.disponible === b.disponible
      ? a.nombre.localeCompare(b.nombre)
      : a.disponible ? -1 : 1
  );
}
