// RF-16 · Selector de fotos. Versión para Android e iOS.
// Elegir una foto de la galería en el celular requiere el módulo `expo-image-picker`, que aún no está
// instalado en el proyecto. Mientras tanto se avisa con claridad (la versión web sí permite adjuntar).
// Para activarlo: `npx expo install expo-image-picker` y devolver aquí { formato, bytes, datos (base64), uri }.
export type ImagenElegida = { formato: string; bytes: number; datos: string; uri: string };

export async function pickImage(): Promise<ImagenElegida | null> {
  throw new Error('Adjuntar fotos desde el celular estará disponible pronto. Por ahora usa la versión web.');
}
