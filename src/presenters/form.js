import { Money } from "../models/Money.js"; // Outil qui vérifie et arrondit un montant.
import { Period } from "../models/Period.js"; // Outil qui vérifie qu'une date a la forme AAAA-MM-JJ.
import { field, options } from "../views/html.js"; // field : une ligne de formulaire. options : les choix d'une liste déroulante.

export function redirect(location) { // Demande au serveur d'envoyer le navigateur vers une autre adresse.
  return { type: "redirect", location }; // type dit « redirection », location est l'adresse cible.
} // Fin de redirect.

export function html(body, status = 200) { // Prépare une réponse HTML. status vaut 200 (succès) si on ne le précise pas.
  return { type: "html", status, body }; // type dit « page HTML », avec le code et le texte de la page.
} // Fin de html.

export function today() { // Date du jour au format AAAA-MM-JJ, pour préremplir un champ date.
  return new Date().toISOString().slice(0, 10); // L'heure ISO commence par la date : on garde les 10 premiers caractères.
} // Fin de today.

export function clean(value) { // Enlève les espaces au début et à la fin d'un texte de formulaire.
  return String(value ?? "").trim(); // Si le champ est absent, on part d'une chaîne vide, puis on coupe les espaces.
} // Fin de clean.

export function readAmount(raw, errors) { // Lit un montant. En cas d'échec, ajoute le message dans errors.
  const parsed = Money.parse(raw); // Vérifie la forme et arrondit au centime.
  if (!parsed.ok) errors.push(parsed.error); // Montant refusé : on garde le message pour le formulaire.
  return parsed.value; // Nombre si c'est bon, sinon undefined. L'appelant ne l'enregistre que s'il n'y a aucune erreur.
} // Fin de readAmount.

export function readDate(raw, errors, label = "La date") { // Lit une date. label est le début de la phrase d'erreur.
  const value = clean(raw); // Texte nettoyé.
  if (!Period.isIsoDate(value)) errors.push(`${label} est invalide.`); // Refuse si ce n'est pas une vraie date AAAA-MM-JJ.
  return value; // Renvoie le texte, même invalide, pour le réafficher dans le formulaire.
} // Fin de readDate.

export function categoryOptions(categories) { // Transforme des catégories de la base en choix de liste (valeur + texte).
  return categories.map((item) => ({ value: item.id_categorie, label: item.nom_categorie })); // Numéro en valeur, nom affiché.
} // Fin de categoryOptions.

export function expenseFields(categories, values) { // Champs HTML du formulaire de dépense. values sert à réafficher ce qui a été tapé.
  const payments = ["Espèces", "Carte", "Mobile money", "Virement", "Autre"].map((item) => ({ value: item, label: item })); // Moyens de paiement proposés.
  return [ // Liste des lignes, collées ensuite en un seul texte HTML.
    field("Montant", `<input name="montant" value="${escapeAttr(values.montant)}" required>`), // Montant obligatoire.
    field("Catégorie", `<select name="categorie" required>${options(categoryOptions(categories), values.categorie, "Choisir")}</select>`), // Liste des catégories de dépense, choix obligatoire.
    field("Date", `<input type="date" name="date" value="${escapeAttr(values.date || today())}" required>`), // Date obligatoire, aujourd'hui si rien n'est encore choisi.
    field("Moyen de paiement", `<select name="moyen_paiement">${options(payments, values.moyen_paiement || "Espèces")}</select>`), // Moyen de paiement, « Espèces » par défaut.
    field("Description", `<input name="description" value="${escapeAttr(values.description)}">`), // Description libre, facultative.
  ].join(""); // Colle les lignes sans séparateur.
} // Fin de expenseFields.

export function incomeFields(categories, values) { // Champs HTML du formulaire de revenu.
  return [ // Liste des lignes du formulaire.
    field("Montant", `<input name="montant" value="${escapeAttr(values.montant)}" required>`), // Montant obligatoire.
    field("Source", `<input name="source" value="${escapeAttr(values.source)}" required>`), // D'où vient l'argent (salaire, vente...), obligatoire.
    field("Catégorie", `<select name="categorie">${options(categoryOptions(categories), values.categorie, "Aucune")}</select>`), // Catégorie facultative : « Aucune » si on ne choisit pas.
    field("Date", `<input type="date" name="date" value="${escapeAttr(values.date || today())}" required>`), // Date obligatoire, aujourd'hui par défaut.
    field("Description", `<input name="description" value="${escapeAttr(values.description)}">`), // Description libre, facultative.
  ].join(""); // Colle les lignes.
} // Fin de incomeFields.

function escapeAttr(value) { // Rend un texte sûr à placer dans un attribut HTML (entre guillemets).
  return String(value ?? "") // Texte, ou chaîne vide si la valeur est absente.
    .replaceAll("&", "&amp;") // Le & ne doit pas commencer un code spécial.
    .replaceAll("<", "&lt;") // Le < ne doit pas ouvrir une balise.
    .replaceAll(">", "&gt;") // Le > est remplacé aussi.
    .replaceAll('"', "&quot;"); // Le guillemet ne doit pas fermer l'attribut.
} // Fin de escapeAttr.
