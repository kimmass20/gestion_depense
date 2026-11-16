function iso(date) { // Transforme un objet date en texte année-mois-jour, par exemple 2026-11-16.
  const y = date.getFullYear(); // Année sur quatre chiffres.
  const m = String(date.getMonth() + 1).padStart(2, "0"); // Mois de 01 à 12. getMonth commence à 0, donc on ajoute 1.
  const d = String(date.getDate()).padStart(2, "0"); // Jour du mois, toujours sur deux chiffres.
  return `${y}-${m}-${d}`; // On recolle année, mois et jour avec des tirets.
} // Fin de la fonction iso.

// Calcule les dates de début et de fin selon le bouton choisi : jour, semaine, mois ou année.
export class Period {
  static range(name, now = new Date()) { // name est le nom de la période. now est « aujourd'hui » si on ne passe rien.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Début : aujourd'hui, à minuit (sans l'heure).
    const end = new Date(start); // Copie de cette date, qu'on décalera selon le cas.
    if (name === "jour") { // Cas « journée ».
      return { start: iso(start), end: iso(end), label: "Aujourd'hui" }; // Début et fin sont le même jour. label est le texte affiché.
    } // Fin du cas journée.
    if (name === "semaine") { // Cas « semaine ».
      const day = start.getDay() || 7; // Jour de la semaine : dimanche vaut 0, on le traite comme 7 pour finir la semaine au dimanche.
      start.setDate(start.getDate() - day + 1); // Recule jusqu'au lundi.
      end.setTime(start.getTime()); // Repart de ce lundi pour calculer la fin.
      end.setDate(start.getDate() + 6); // Avance de 6 jours : le dimanche.
      return { start: iso(start), end: iso(end), label: "Cette semaine" }; // Du lundi au dimanche.
    } // Fin du cas semaine.
    if (name === "annee") { // Cas « année ».
      return { // On renvoie un objet avec trois informations.
        start: iso(new Date(now.getFullYear(), 0, 1)), // 1er janvier de l'année en cours. Le mois 0 est janvier.
        end: iso(new Date(now.getFullYear(), 11, 31)), // 31 décembre. Le mois 11 est décembre.
        label: "Cette année", // Texte affiché.
      }; // Fin de l'objet année.
    } // Fin du cas année.
    return { // Tous les autres noms, dont « mois », tombent ici.
      start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), // Premier jour du mois en cours.
      end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)), // Jour 0 du mois suivant = dernier jour de ce mois.
      label: "Ce mois", // Texte affiché.
    }; // Fin de l'objet mois.
  } // Fin du calcul d'une période.

  static monthWindow(count = 6, now = new Date()) { // Liste des derniers mois. Par défaut : 6 mois, jusqu'à aujourd'hui.
    const months = []; // Tableau vide qu'on va remplir.
    for (let i = count - 1; i >= 0; i -= 1) { // On part du mois le plus ancien et on avance jusqu'au mois actuel.
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1); // Le 1er du mois situé i mois en arrière.
      const start = iso(date); // Premier jour de ce mois, en texte.
      const end = iso(new Date(date.getFullYear(), date.getMonth() + 1, 0)); // Dernier jour de ce mois.
      const label = date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }); // Exemple : « nov. 26 ».
      months.push({ start, end, label }); // On ajoute ce mois à la liste.
    } // Fin de la boucle sur les mois.
    return months; // On renvoie la liste, du plus ancien au plus récent.
  } // Fin de la fenêtre de mois.

  static isIsoDate(value) { // Dit si un texte est une vraie date année-mois-jour.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false; // Refuse si la forme n'est pas exactement 0000-00-00.
    const [y, m, d] = value.split("-").map(Number); // Sépare l'année, le mois et le jour, et les transforme en nombres.
    const date = new Date(y, m - 1, d); // Construit la date. Le mois JavaScript commence à 0.
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d; // Vrai seulement si la date existe vraiment (pas le 31 février).
  } // Fin du contrôle de date.
} // Fin de la classe Period.
