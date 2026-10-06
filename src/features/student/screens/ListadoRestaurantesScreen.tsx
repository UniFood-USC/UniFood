import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { RestaurantePublico } from "../types/restaurante";
import { listarRestaurantes } from "../services/restaurantes";

interface Props {
  // Quien integre decide qué hacer al tocar. Si disponible=false NO se
  // permiten pedidos inmediatos (solo reserva, ver RF-26).
  onSeleccionar?: (restaurante: RestaurantePublico) => void;
}

export default function ListadoRestaurantesScreen({ onSeleccionar }: Props) {
  const [restaurantes, setRestaurantes] = useState<RestaurantePublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setRestaurantes(await listarRestaurantes());
    } catch {
      setError("No se pudo cargar la lista de restaurantes. Intenta de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return <View style={s.centro}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return (
      <View style={s.centro}>
        <Text style={s.mensaje}>{error}</Text>
        <TouchableOpacity onPress={() => { setCargando(true); cargar(); }}>
          <Text style={s.reintentar}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={restaurantes}
      keyExtractor={(r) => r.id}
      contentContainerStyle={restaurantes.length ? s.lista : s.centroLista}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => { setRefrescando(true); cargar(); }}
        />
      }
      ListEmptyComponent={
        <Text style={s.mensaje}>No hay restaurantes para mostrar.</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[s.tarjeta, !item.disponible && s.tarjetaCerrada]}
          onPress={() => onSeleccionar?.(item)}
          accessibilityLabel={`${item.nombre}, ${item.disponible ? "abierto" : "cerrado"}`}
        >
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={s.logo} />
          ) : (
            <View style={[s.logo, s.logoVacio]}>
              <Text style={s.inicial}>{item.nombre.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={s.info}>
            <Text style={s.nombre}>{item.nombre}</Text>
            {item.disponible ? (
              <Text style={s.abierto}>Abierto</Text>
            ) : (
              <>
                <Text style={s.cerrado}>Cerrado</Text>
                {item.proximaApertura && (
                  <Text style={s.apertura}>Abre: {item.proximaApertura}</Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centroLista: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  lista: { padding: 16, gap: 12 },
  mensaje: { fontSize: 16, textAlign: "center", color: "#555" },
  reintentar: { marginTop: 12, fontSize: 16, color: "#1a73e8", fontWeight: "600" },
  tarjeta: {
    flexDirection: "row", alignItems: "center", padding: 12,
    backgroundColor: "#fff", borderRadius: 12, elevation: 2,
  },
  tarjetaCerrada: { opacity: 0.6 },
  logo: { width: 56, height: 56, borderRadius: 28 },
  logoVacio: { backgroundColor: "#ddd", justifyContent: "center", alignItems: "center" },
  inicial: { fontSize: 22, fontWeight: "700", color: "#555" },
  info: { marginLeft: 12, flex: 1 },
  nombre: { fontSize: 17, fontWeight: "600" },
  abierto: { color: "#188038", marginTop: 2 },
  cerrado: { color: "#c5221f", fontWeight: "600", marginTop: 2 },
  apertura: { color: "#555", marginTop: 2 },
});
