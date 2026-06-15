import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Todos los datos de la quiniela viven en la colección "quiniela",
// un documento por "llave" (matches, players, admin-pin, predictions:xxx).
// Esto imita la API window.storage.get/set de los artefactos de Claude
// para que el resto del componente no tenga que cambiar su lógica.

export async function storageGet(key) {
  try {
    const ref = doc(db, 'quiniela', key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { key, value: snap.data().value };
  } catch (err) {
    console.error('storageGet error:', key, err);
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    const ref = doc(db, 'quiniela', key);
    await setDoc(ref, { value, updatedAt: Date.now() });
    return { key, value };
  } catch (err) {
    console.error('storageSet error:', key, err);
    return null;
  }
}
