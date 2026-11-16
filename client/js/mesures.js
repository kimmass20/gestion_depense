import { listMesures, saveMesure } from "./stockage.js"; // Fonctions qui écrivent et relisent les durées dans la base du navigateur.

export async function mesurer(nom, action) { // Chronomètre une action. nom est un libellé, action est la fonction à lancer.
  const debut = performance.now(); // Heure de départ en millisecondes, très précise, donnée par le navigateur.
  try { // On lance l'action. Si elle échoue, on passe dans catch sans perdre la mesure.
    const resultat = await action(); // On attend la fin de l'action (souvent un appel au serveur).
    await saveMesure({ nom, dureeMs: Math.round(performance.now() - debut), statut: "ok" }); // Durée arrondie en millisecondes, statut « ok ».
    return resultat; // On renvoie ce que l'action a produit, comme si le chronomètre n'était pas là.
  } catch (error) { // L'action a échoué.
    await saveMesure({ nom, dureeMs: Math.round(performance.now() - debut), statut: "erreur" }); // On enregistre quand même la durée, avec le statut « erreur ».
    throw error; // On relance l'erreur pour que la page puisse afficher le message.
  } // Fin du cas d'échec.
} // Fin du chronomètre.

export async function exporterMesures() { // Télécharge toutes les mesures dans un fichier mesures.csv.
  const rows = await listMesures(); // Relit les lignes gardées dans le navigateur.
  const header = "id,horodatage,nom,dureeMs,statut"; // Première ligne du fichier : les noms des colonnes.
  const body = rows.map((row) => [row.id, row.horodatage, csv(row.nom), row.dureeMs, row.statut].join(",")); // Chaque mesure devient une ligne de texte, colonnes séparées par des virgules.
  const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv;charset=utf-8" }); // Fichier en mémoire. \n sépare les lignes. Le type dit « tableau de texte ».
  const url = URL.createObjectURL(blob); // Adresse temporaire qui pointe vers ce fichier en mémoire.
  const link = document.createElement("a"); // Crée un lien invisible dans la page.
  link.href = url; // Le lien pointe vers le fichier.
  link.download = "mesures.csv"; // Le navigateur proposera ce nom au téléchargement.
  link.click(); // On déclenche le téléchargement comme si l'utilisateur cliquait.
  URL.revokeObjectURL(url); // On libère l'adresse temporaire.
} // Fin de l'export.

function csv(value) { // Protège un texte pour qu'une virgule ou un guillemet ne casse pas les colonnes.
  const text = String(value ?? ""); // Transforme en texte. Si la valeur est vide, on met une chaîne vide.
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; // S'il y a un guillemet, une virgule ou un saut de ligne, on entoure le texte de guillemets et on double les guillemets internes. Sinon on le laisse tel quel.
} // Fin de la protection CSV.
