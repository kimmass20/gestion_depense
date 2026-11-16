import path from "node:path"; // Outil de Node pour fabriquer un chemin de fichier selon le système.
import { createApp } from "./app.js"; // Fonction qui construit l'application web (routes, session, base).

const dbPath = path.resolve("data", "depenses.sqlite"); // Chemin complet du fichier de base de données, dossier data.
const port = Number(process.env.PORT || 3000); // Port d'écoute : la variable PORT si elle existe, sinon 3000.
const app = createApp(dbPath); // Crée l'application en lui donnant où enregistrer les données.

app.listen(port, () => { // Démarre le serveur et exécute la fonction quand il est prêt.
  console.log(`Application disponible sur http://localhost:${port}`); // Affiche l'adresse à ouvrir dans le navigateur.
}); // Fin du démarrage.
