import { errorArchivoFoto } from '../../domain/productManagement';

// RF-16 · Selector de fotos para la versión web: abre el explorador de archivos.
// El archivo se lee solo si es JPG o PNG de hasta 5 MB; si no, se devuelve sin contenido
// y la pantalla muestra el error sin subir nada.
export type ImagenElegida = { formato: string; bytes: number; datos: string; uri: string };

export function pickImage(): Promise<ImagenElegida | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.style.display = 'none';
    document.body.appendChild(input);   // si queda suelto, algunos navegadores no avisan de la selección
    const limpiar = () => input.remove();
    input.onchange = () => {
      const file = input.files?.[0];
      limpiar();
      if (!file) { resolve(null); return; }
      if (errorArchivoFoto(file.type, file.size)) { resolve({ formato: file.type, bytes: file.size, datos: '', uri: '' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        resolve({ formato: file.type, bytes: file.size, datos: url.slice(url.indexOf(',') + 1), uri: url });
      };
      reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
      reader.readAsDataURL(file);
    };
    input.oncancel = () => { limpiar(); resolve(null); };
    input.click();
  });
}