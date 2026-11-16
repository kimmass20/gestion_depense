const NAME = "depenses"; // Nom de la petite base gardée dans le navigateur (IndexedDB), pas le fichier SQLite du serveur.
const VERSION = 1; // Numéro de version de cette base. L'augmenter relancerait la création des casiers.

function openDb() { // Ouvre la base du navigateur et la renvoie quand elle est prête.
  return new Promise((resolve, reject) => { // Promise : un résultat qui arrivera plus tard. resolve = succès, reject = échec.
    const request = indexedDB.open(NAME, VERSION); // Demande d'ouverture. IndexedDB est la base intégrée au navigateur.
    request.onupgradeneeded = () => { // Ce bloc ne tourne que si la base est nouvelle ou si le numéro de version a changé.
      const db = request.result; // La base en cours d'ouverture.
      if (!db.objectStoreNames.contains("mesures")) { // Si le casier « mesures » n'existe pas encore.
        db.createObjectStore("mesures", { keyPath: "id", autoIncrement: true }); // On le crée. Chaque mesure aura un numéro id automatique.
      } // Fin de la création du casier des mesures.
      if (!db.objectStoreNames.contains("metadonnees")) { // Si le casier des copies de pages n'existe pas.
        db.createObjectStore("metadonnees", { keyPath: "cle" }); // On le crée. La clé est un nom (par exemple « tableau »).
      } // Fin de la création du casier des copies.
    }; // Fin de la mise à niveau.
    request.onsuccess = () => resolve(request.result); // Ouverture réussie : on transmet la base.
    request.onerror = () => reject(request.error); // Ouverture ratée : on transmet l'erreur.
  }); // Fin de la promesse d'ouverture.
} // Fin de openDb.

export async function saveMesure(mesure) { // Enregistre une durée mesurée. export la rend utilisable par les autres fichiers.
  const db = await openDb(); // Attend l'ouverture de la base.
  await new Promise((resolve, reject) => { // Attend la fin de l'écriture.
    const tx = db.transaction("mesures", "readwrite"); // Transaction : un bloc d'écriture sur le casier « mesures ». readwrite = lecture et écriture.
    tx.objectStore("mesures").add({ ...mesure, horodatage: new Date().toISOString() }); // Ajoute la mesure plus l'heure actuelle. Les trois points copient les champs déjà fournis.
    tx.oncomplete = resolve; // Écriture terminée.
    tx.onerror = () => reject(tx.error); // Écriture ratée.
  }); // Fin de l'attente d'écriture.
  db.close(); // Ferme la base.
} // Fin de l'enregistrement d'une mesure.

export async function listMesures() { // Relit toutes les mesures, pour le fichier CSV.
  const db = await openDb(); // Ouvre la base.
  const rows = await new Promise((resolve, reject) => { // Attend la lecture.
    const tx = db.transaction("mesures", "readonly"); // Transaction en lecture seule.
    const request = tx.objectStore("mesures").getAll(); // Demande toutes les lignes.
    request.onsuccess = () => resolve(request.result); // Lecture réussie : on transmet le tableau.
    request.onerror = () => reject(request.error); // Lecture ratée.
  }); // Fin de l'attente de lecture.
  db.close(); // Ferme la base.
  return rows; // Renvoie les mesures.
} // Fin de la liste des mesures.

export async function saveMeta(cle, valeur) { // Garde une copie de données déjà affichées, pour les revoir hors ligne. cle est le nom de la page.
  const db = await openDb(); // Ouvre la base.
  await new Promise((resolve, reject) => { // Attend l'écriture.
    const tx = db.transaction("metadonnees", "readwrite"); // Écriture dans le casier des copies.
    tx.objectStore("metadonnees").put({ cle, valeur, misAJour: new Date().toISOString() }); // put ajoute ou remplace la ligne qui a cette clé.
    tx.oncomplete = resolve; // Écriture terminée.
    tx.onerror = () => reject(tx.error); // Écriture ratée.
  }); // Fin de l'attente.
  db.close(); // Ferme la base.
} // Fin de la sauvegarde d'une copie.

export async function readMeta(cle) { // Relit la copie d'une page, ou null s'il n'y en a pas.
  const db = await openDb(); // Ouvre la base.
  const row = await new Promise((resolve, reject) => { // Attend la lecture.
    const tx = db.transaction("metadonnees", "readonly"); // Lecture seule.
    const request = tx.objectStore("metadonnees").get(cle); // Cherche la ligne dont la clé est ce nom.
    request.onsuccess = () => resolve(request.result || null); // Ligne trouvée, ou null si elle n'existe pas.
    request.onerror = () => reject(request.error); // Lecture ratée.
  }); // Fin de l'attente.
  db.close(); // Ferme la base.
  return row ? row.valeur : null; // S'il y a une ligne, on renvoie seulement la valeur gardée.
} // Fin de la lecture d'une copie.
