export function escapeHtml(value) { // Empêche un texte saisi par l'utilisateur d'être lu comme du HTML.
  return String(value ?? "") // Transforme en texte. Si la valeur est absente, on part d'une chaîne vide.
    .replaceAll("&", "&amp;") // Le & doit être écrit en code, sinon il commence un caractère spécial.
    .replaceAll("<", "&lt;") // Le < ne doit pas ouvrir une balise.
    .replaceAll(">", "&gt;") // Le > est remplacé aussi.
    .replaceAll('"', "&quot;") // Le guillemet ne doit pas fermer un attribut.
    .replaceAll("'", "&#39;"); // L'apostrophe non plus.
} // Fin de escapeHtml.

export function page(title, body) { // Enveloppe une page complète : en-tête, titre, styles, puis le corps reçu.
  return `<!DOCTYPE html> <!-- Dit au navigateur : ceci est une page HTML moderne. -->
<html lang="fr"> <!-- Balise racine. lang="fr" annonce que la page est en français. -->
<head> <!-- En-tête : informations sur la page, pas le contenu visible. -->
  <meta charset="utf-8"> <!-- Les lettres accentuées sont lues correctement. -->
  <meta name="viewport" content="width=device-width, initial-scale=1"> <!-- Sur un téléphone, la largeur suit l'écran. -->
  <title>${escapeHtml(title)} · Dépenses</title> <!-- Texte de l'onglet : le titre de la page, puis le nom de l'application. -->
  <link rel="preconnect" href="https://fonts.googleapis.com"> <!-- Ouvre tôt la connexion vers le site des polices. -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> <!-- Deuxième adresse du même service. crossorigin autorise cette connexion anticipée. -->
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0&display=swap" rel="stylesheet"> <!-- Charge la police Geist et les icônes. -->
  <link rel="stylesheet" href="/css/app.css"> <!-- Charge notre fichier d'apparence. -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script> <!-- Charge Chart.js, la bibliothèque qui dessine les graphiques. -->
</head> <!-- Fin de l'en-tête. -->
<body> <!-- Corps : le contenu visible. -->
${body} <!-- HTML préparé par la vue : menu plus contenu, ou page publique. -->
<script src="/js/charts.js"></script> <!-- Notre script qui lit les données cachées et dessine les graphiques. -->
</body> <!-- Fin du corps. -->
</html>`; // Fin de la page.
} // Fin de page.

export function field(label, html) { // Une ligne de formulaire : un libellé et le champ HTML déjà construit.
  return `<label class="field"><span>${escapeHtml(label)}</span>${html}</label>`; // Le libellé est protégé. html est du HTML qu'on a nous-mêmes écrit.
} // Fin de field.

export function errors(list) { // Liste rouge des messages d'erreur, ou rien s'il n'y en a pas.
  if (!list?.length) return ""; // Pas de liste, ou liste vide : on n'affiche rien. ?. évite une erreur si list est absent.
  return `<ul class="errors">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`; // Une puce par message, texte protégé.
} // Fin de errors.

export function flash(message) { // Bandeau vert de confirmation, affiché une seule fois.
  if (!message) return ""; // Pas de message : rien à afficher.
  return `<p class="flash">${escapeHtml(message)}</p>`; // Paragraphe avec le texte protégé.
} // Fin de flash.

export function options(items, selected, placeholder) { // Choix d'une liste déroulante. selected est la valeur déjà choisie.
  const head = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ""; // Première option vide, avec un texte du genre « Choisir », seulement si on l'a demandé.
  const body = items.map((item) => { // Une option par élément.
    const selectedAttr = String(item.value) === String(selected ?? "") ? " selected" : ""; // selected si la valeur correspond. On compare en texte pour que 3 et "3" matchent.
    return `<option value="${escapeHtml(item.value)}"${selectedAttr}>${escapeHtml(item.label)}</option>`; // Valeur envoyée au serveur, texte montré à la personne.
  }).join(""); // Colle les options.
  return head + body; // Option vide d'abord, puis les vrais choix.
} // Fin de options.
