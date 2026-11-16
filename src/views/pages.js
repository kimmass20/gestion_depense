import { Money } from "../models/Money.js"; // Affiche un nombre comme un montant en dollars.
import { escapeHtml, errors, field, options } from "./html.js"; // Protège le texte, liste d'erreurs, ligne de formulaire, choix d'une liste.

const PERIODS = [ // Boutons et listes de période, dans le même ordre partout.
  { value: "jour", label: "Journée" }, // Valeur envoyée dans l'adresse, texte affiché.
  { value: "semaine", label: "Semaine" }, // Semaine en cours.
  { value: "mois", label: "Mois" }, // Mois en cours.
  { value: "annee", label: "Année" }, // Année en cours.
]; // Fin des périodes.

function moneyClass(value) { // Classe CSS selon le signe : vert si positif ou nul, rouge si négatif.
  return value < 0 ? "neg" : "pos"; // neg et pos sont des couleurs définies dans la feuille de style.
} // Fin de moneyClass.

function formatDate(iso) { // Transforme AAAA-MM-JJ en date française, par exemple « 16 nov. 2026 ».
  if (!iso) return ""; // Pas de date : on n'affiche rien.
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number); // Année, mois, jour en nombres. On ignore l'heure s'il y en a une.
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); // Le mois JavaScript commence à 0, d'où le - 1. On construit la date en local pour éviter le décalage d'un jour.
} // Fin de formatDate.

function jsonIsland(id, data) { // Cache des données dans la page pour que charts.js les lise. Ce n'est pas un script exécuté.
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`; // type application/json : le navigateur n'exécute pas ce bloc. Le < est écrit en code pour qu'un texte ne puisse pas fermer la balise.
} // Fin de jsonIsland.

function emptyRow(cols, text) { // Une ligne de tableau qui dit qu'il n'y a rien. cols est le nombre de colonnes à fusionner.
  return `<tr><td class="empty" colspan="${cols}">${escapeHtml(text)}</td></tr>`; // Une seule cellule qui s'étend sur toutes les colonnes.
} // Fin de emptyRow.

export class DashboardView { // HTML du tableau de bord.
  render({ rangeName, rangeLabel, summary, soldeActuel, budgetDisponible, recent, categories, series, budgets }) { // Reçoit les chiffres déjà calculés par le présentateur.
    const budgetText = budgetDisponible === null ? "Aucun budget" : Money.format(budgetDisponible); // Texte de la carte budget : une phrase, ou un montant.
    const cards = [ // Quatre grandes cartes. Chaque ligne : libellé, valeur, classe de couleur.
      ["Solde actuel", soldeActuel, moneyClass(soldeActuel)], // Solde depuis le début.
      [`Revenus · ${rangeLabel}`, summary.revenus, "pos"], // Revenus de la période, toujours en vert.
      [`Dépenses · ${rangeLabel}`, summary.depenses, "neg"], // Dépenses de la période, toujours en rouge.
      ["Budget disponible", budgetText, budgetDisponible === null ? "" : budgetDisponible < 0 ? "neg" : "pos"], // Pas de couleur s'il n'y a pas de budget.
    ].map(([label, value, tone]) => /* HTML d'une carte de total */ `
      <article class="card"> <!-- Une carte. -->
        <p>${escapeHtml(label)}</p> <!-- Petit titre. -->
        <strong class="${tone}">${typeof value === "number" ? Money.format(value) : escapeHtml(value)}</strong> <!-- Montant formaté si c'est un nombre, sinon le texte tel quel (cas « Aucun budget »). -->
      </article>`).join(""); // Colle les quatre cartes.

    const rows = recent.map((op) => { // Une ligne du tableau par opération récente.
      const expense = op.kind === "Dépense"; // Vrai pour une dépense, faux pour un revenu.
      return /* une ligne du tableau des opérations récentes */ `
      <tr> <!-- Ligne du tableau. -->
        <td>${formatDate(op.date)}</td> <!-- Date en français. -->
        <td><span class="pill ${expense ? "depense" : "revenu"}">${escapeHtml(op.kind)}</span></td> <!-- Pastille rouge ou verte selon le type. -->
        <td>${escapeHtml(op.label)}</td> <!-- Source ou catégorie. -->
        <td class="num ${expense ? "neg" : "pos"}">${expense ? "−" : "+"}${Money.format(op.montant)}</td> <!-- Moins devant une dépense, plus devant un revenu. -->
      </tr>`; // Fin de la ligne.
    }).join(""); // Colle les lignes. Chaîne vide si la liste est vide.

    const budgetCards = budgets.map((item) => { // Une carte par budget en cours.
      const ratio = Math.min(100, Math.round((item.spent / item.limit) * 100)); // Pourcentage dépensé, plafonné à 100 pour que la barre ne dépasse pas.
      return /* une carte de budget avec sa barre */ `
      <article class="card ${item.level}"> <!-- level vaut ok, proche ou depasse : la couleur de la carte en dépend. -->
        <p>${escapeHtml(item.nom)}</p> <!-- Nom du budget. -->
        <strong>${Money.format(item.remaining)} restants</strong> <!-- Ce qu'il reste. Peut être négatif si le budget est dépassé. -->
        <div class="progress"><i style="width:${ratio}%"></i></div> <!-- Barre : la largeur en pourcent représente la part déjà dépensée. -->
        <small>${Money.format(item.spent)} dépensés sur ${Money.format(item.limit)}</small> <!-- Rappel des deux montants. -->
      </article>`; // Fin de la carte.
    }).join(""); // Colle les cartes.

    const periods = PERIODS.map((item) => `<a class="${item.value === rangeName ? "on" : ""}" href="/?periode=${item.value}">${item.label}</a>`).join(""); // Liens de période. La classe on marque celle qui est affichée.
    return /* page complète du tableau de bord */ `
      <div class="page-title"> <!-- Titre et boutons de période sur la même ligne. -->
        <div><p class="kicker">Aperçu</p><h1>Tableau de bord</h1></div> <!-- Petit mot au-dessus du grand titre. -->
        <nav class="segment">${periods}</nav> <!-- Groupe de liens jour / semaine / mois / année. -->
      </div> <!-- Fin du titre. -->
      <section class="cards">${cards}</section> <!-- Les quatre cartes de totaux. -->
      <section class="split"> <!-- Deux colonnes : tableau à gauche, graphiques à droite. -->
        <div class="table-wrap"> <!-- Cadre du tableau. -->
          <h2 class="section-title">Dernières opérations</h2> <!-- Titre du tableau. -->
          <table><thead><tr><th>Date</th><th>Type</th><th>Libellé</th><th>Montant</th></tr></thead><tbody>${rows || emptyRow(4, "Aucune opération sur cette période.")}</tbody></table> <!-- En-têtes, puis les lignes, ou une phrase si la liste est vide. -->
        </div> <!-- Fin du tableau. -->
        <div class="stack"> <!-- Graphiques empilés. -->
          <div class="chart-card"> <!-- Cadre de la courbe. -->
            <h2>Évolution des dépenses</h2> <!-- Titre. -->
            <canvas id="spend-chart"></canvas> <!-- Zone de dessin. charts.js la retrouve par cet id. -->
          </div> <!-- Fin de la courbe. -->
          <div class="chart-card"> <!-- Cadre du camembert. -->
            <h2>Catégories les plus dépensières</h2> <!-- Titre. -->
            ${categories.length ? `<canvas id="category-chart"></canvas>` : `<p class="empty">Aucune dépense sur cette période.</p>`} <!-- Le dessin n'est mis que s'il y a des catégories. Sinon une phrase. -->
          </div> <!-- Fin du camembert. -->
        </div> <!-- Fin de la pile. -->
      </section> <!-- Fin des deux colonnes. -->
      ${jsonIsland("spend-series", { labels: series.map((item) => item.label), values: series.map((item) => item.total) })} <!-- Données cachées de la courbe : noms des mois et totaux. -->
      ${jsonIsland("category-series", { labels: categories.map((item) => item.nom), values: categories.map((item) => item.total) })} <!-- Données cachées du camembert. -->
      <h2>Budgets en cours</h2> <!-- Titre de la rangée de budgets. -->
      <section class="cards">${budgetCards || `<p class="empty">Aucun budget en cours. Définissez-en un dans la page Budgets.</p>`}</section>`; // Cartes, ou une phrase si la liste est vide.
  } // Fin de render.
} // Fin de DashboardView.

export class OperationView { // Formulaire plus tableau, utilisé à la fois pour les revenus et les dépenses.
  list({ title, rows, form, editing }) { // title : titre du tableau. rows : lignes. form : champs. editing : mode modification ou null.
    const body = rows.map((row) => /* une ligne revenu ou dépense */ `
      <tr> <!-- Une opération. -->
        <td>${formatDate(row.date)}</td> <!-- Date. -->
        <td>${Money.format(row.montant)}</td> <!-- Montant. -->
        <td>${escapeHtml(row.primary)}</td> <!-- Source pour un revenu, catégorie pour une dépense. -->
        <td>${escapeHtml(row.secondary)}</td> <!-- Catégorie pour un revenu, moyen de paiement pour une dépense. -->
        <td>${escapeHtml(row.description || "")}</td> <!-- Description, ou rien. -->
        <td class="actions"> <!-- Boutons à droite. -->
          <a href="${row.editHref}">Modifier</a> <!-- Ouvre le formulaire rempli. -->
          <form method="post" action="${row.deleteHref}" onsubmit="return confirm('Supprimer cette opération ?')"> <!-- POST de suppression. confirm demande oui ou non avant d'envoyer. -->
            <button class="danger" type="submit">Supprimer</button> <!-- Bouton rouge. -->
          </form> <!-- Fin du formulaire de suppression. -->
        </td> <!-- Fin des boutons. -->
      </tr>`).join(""); // Colle les lignes.
    return /* formulaire à gauche, tableau à droite */ `
      <section class="split"> <!-- Formulaire à gauche, tableau à droite. -->
        <form method="post" class="panel" action="${editing ? editing.action : form.action}"> <!-- En modification, l'adresse contient le numéro. Sinon c'est l'adresse de création. -->
          <h2>${editing ? "Modifier" : "Enregistrer"}</h2> <!-- Le titre change selon le mode. -->
          ${errors(form.errors)} <!-- Messages d'erreur, ou rien. -->
          ${form.fields} <!-- Champs déjà construits par incomeFields ou expenseFields. -->
          <button type="submit">${editing ? "Mettre à jour" : "Enregistrer"}</button> <!-- Bouton d'envoi. -->
          ${editing ? `<a href="${form.action}">Annuler</a>` : ""} <!-- En modification, un lien pour revenir au formulaire vide. -->
        </form> <!-- Fin du formulaire. -->
        <div class="table-wrap"> <!-- Cadre du tableau. -->
          <h2>${escapeHtml(title)}</h2> <!-- Titre reçu : « Revenus enregistrés » ou « Dépenses enregistrées ». -->
          <table> <!-- Tableau. -->
            <thead><tr><th>Date</th><th>Montant</th><th>${escapeHtml(form.primaryLabel)}</th><th>${escapeHtml(form.secondaryLabel)}</th><th>Description</th><th></th></tr></thead> <!-- En-têtes. La dernière colonne, vide, est celle des boutons. -->
            <tbody>${body || emptyRow(6, "Aucune opération.")}</tbody> <!-- Lignes, ou une phrase sur 6 colonnes. -->
          </table> <!-- Fin du tableau. -->
        </div> <!-- Fin du cadre. -->
      </section>`; // Fin des deux colonnes.
  } // Fin de list.
} // Fin de OperationView.

export class CategoryView { // Formulaire de création et tableau des catégories.
  render({ categories, errors: formErrors, values }) { // errors est renommé formErrors pour ne pas cacher la fonction errors importée.
    const rows = categories.map((item) => /* une ligne de catégorie */ `
      <tr> <!-- Une catégorie. -->
        <td>${escapeHtml(item.nom_categorie)}</td> <!-- Nom. -->
        <td><span class="pill ${item.type_categorie}">${item.type_categorie === "revenu" ? "Revenu" : "Dépense"}</span></td> <!-- Pastille selon le type. La classe CSS reprend le mot revenu ou depense. -->
        <td>${item.id_utilisateur ? "Personnelle" : "Prédéfinie"}</td> <!-- S'il y a un propriétaire, elle a été créée par le compte. Sinon elle est fournie au départ. -->
        <td>${item.id_utilisateur ? /* boutons seulement pour une catégorie personnelle */ `
          <form method="post" action="/categories/${item.id_categorie}" class="inline"> <!-- Formulaire de renommage, sur la même ligne. -->
            <input name="nom" value="${escapeHtml(item.nom_categorie)}" required> <!-- Champ prérempli avec le nom actuel. -->
            <button type="submit">Renommer</button> <!-- Envoie le nouveau nom. -->
          </form> <!-- Fin du renommage. -->
          <form method="post" action="/categories/${item.id_categorie}/supprimer" onsubmit="return confirm('Supprimer cette catégorie ?')"> <!-- Suppression, avec demande de confirmation. -->
            <button class="danger" type="submit">Supprimer</button> <!-- Bouton rouge. -->
          </form>` : ""}</td> <!-- Les boutons n'existent que pour une catégorie personnelle. Une catégorie prédéfinie n'a pas de boutons. -->
      </tr>`).join(""); // Colle les lignes.
    return /* formulaire de création puis tableau */ `
      <form method="post" class="panel"> <!-- Création. Pas d'action : le formulaire poste vers l'adresse de la page, /categories. -->
        <h2>Nouvelle catégorie</h2> <!-- Titre du formulaire. -->
        ${errors(formErrors)} <!-- Erreurs de la dernière tentative. -->
        ${field("Nom", `<input name="nom" value="${escapeHtml(values.nom || "")}" required>`)} <!-- Nom obligatoire, réaffiché si une erreur a eu lieu. -->
        ${field("Type", `<select name="type">${options([ // Deux choix possibles pour une catégorie.
          { value: "depense", label: "Dépense" }, // Valeur enregistrée, texte affiché.
          { value: "revenu", label: "Revenu" }, // Deuxième choix.
        ], values.type || "depense")}</select>`)} <!-- Liste. « depense » est choisi par défaut. -->
        <button type="submit">Créer</button> <!-- Envoie le formulaire. -->
      </form> <!-- Fin du formulaire. -->
      <table> <!-- Liste. -->
        <thead><tr><th>Nom</th><th>Type</th><th>Origine</th><th></th></tr></thead> <!-- En-têtes. Dernière colonne : les boutons. -->
        <tbody>${rows}</tbody> <!-- Lignes construites plus haut. -->
      </table>`; // Fin du tableau.
  } // Fin de render.
} // Fin de CategoryView.

export class BudgetView { // Formulaire de budget et tableau d'état.
  render({ budgets, categories, formErrors, values }) { // budgets : lignes déjà calculées. categories : choix de la liste.
    const rows = budgets.map((item) => /* une ligne de budget */ `
      <tr> <!-- Un budget. -->
        <td>${escapeHtml(item.nom)}</td> <!-- Nom, ou « Budget global ». -->
        <td>${Money.format(item.limit)}</td> <!-- Plafond. -->
        <td>${Money.format(item.spent)}</td> <!-- Déjà dépensé. -->
        <td class="${item.remaining < 0 ? "neg" : "pos"}">${Money.format(item.remaining)}</td> <!-- Reste, en rouge s'il est négatif. -->
        <td>${escapeHtml(item.date_debut)} → ${escapeHtml(item.date_fin)}</td> <!-- Du début à la fin. -->
        <td><span class="pill ${item.level}">${item.level === "depasse" ? "Dépassé" : item.level === "proche" ? "Proche de la limite" : "Dans la limite"}</span></td> <!-- Pastille selon l'état. -->
        <td> <!-- Bouton. -->
          <form method="post" action="/budgets/${item.id_budget}/supprimer" onsubmit="return confirm('Supprimer ce budget ?')"> <!-- Suppression avec confirmation. -->
            <button class="danger" type="submit">Supprimer</button> <!-- Bouton rouge. -->
          </form> <!-- Fin du formulaire. -->
        </td> <!-- Fin de la cellule. -->
      </tr>`).join(""); // Colle les lignes.
    return /* formulaire de budget puis tableau */ `
      <form method="post" class="panel"> <!-- Création, postée vers /budgets. -->
        <h2>Définir un budget</h2> <!-- Titre. -->
        ${errors(formErrors)} <!-- Erreurs. -->
        ${field("Montant limite", `<input name="montant" value="${escapeHtml(values.montant || "")}" required>`)} <!-- Plafond obligatoire. -->
        ${field("Catégorie", `<select name="categorie">${options(categories, values.categorie, "Budget global")}</select>`)} <!-- Catégorie facultative. L'option vide signifie un budget global. -->
        ${field("Début", `<input type="date" name="date_debut" value="${escapeHtml(values.date_debut || "")}" required>`)} <!-- Date de début. -->
        ${field("Fin", `<input type="date" name="date_fin" value="${escapeHtml(values.date_fin || "")}" required>`)} <!-- Date de fin. -->
        <button type="submit">Enregistrer</button> <!-- Envoie le formulaire. -->
      </form> <!-- Fin du formulaire. -->
      <table> <!-- Liste des budgets. -->
        <thead><tr><th>Budget</th><th>Limite</th><th>Dépensé</th><th>Restant</th><th>Période</th><th>État</th><th></th></tr></thead> <!-- En-têtes. -->
        <tbody>${rows || `<tr><td colspan="7">Aucun budget.</td></tr>`}</tbody> <!-- Lignes, ou une cellule sur 7 colonnes. -->
      </table>`; // Fin du tableau.
  } // Fin de render.
} // Fin de BudgetView.

export class HistoryView { // Filtres et tableau de l'historique.
  render({ rows, filters, categories }) { // rows : opérations déjà triées. filters : choix actuels. categories : choix de la liste.
    const body = rows.map((row) => /* une ligne de l'historique */ `
      <tr> <!-- Une opération. -->
        <td>${formatDate(row.date)}</td> <!-- Date. -->
        <td><span class="pill ${row.kind === "Dépense" ? "depense" : "revenu"}">${escapeHtml(row.kind)}</span></td> <!-- Pastille du type. -->
        <td>${Money.format(row.montant)}</td> <!-- Montant. -->
        <td>${escapeHtml(row.category)}</td> <!-- Catégorie ou source. -->
        <td>${escapeHtml(row.description || "")}</td> <!-- Description. -->
      </tr>`).join(""); // Colle les lignes.
    return /* filtres puis tableau de l'historique */ `
      <form class="filters" method="get"> <!-- Filtres dans l'adresse, pour pouvoir partager ou recharger la même vue. -->
        ${field("Type", `<select name="type">${options([ // Filtre : tout, revenus seuls, ou dépenses seules.
          { value: "toutes", label: "Toutes" }, // Revenus et dépenses.
          { value: "revenu", label: "Revenus" }, // Revenus seuls.
          { value: "depense", label: "Dépenses" }, // Dépenses seules.
        ], filters.type)}</select>`)} <!-- La valeur filters.type est présélectionnée. -->
        ${field("Période", `<select name="periode">${options([{ value: "tout", label: "Tout l'historique" }, ...PERIODS], filters.periode)}</select>`)} <!-- « Tout l'historique » plus jour, semaine, mois, année. -->
        ${field("Catégorie", `<select name="categorie">${options(categories, filters.categorie, "Toutes")}</select>`)} <!-- Liste des catégories, avec une option vide « Toutes ». -->
        <button type="submit">Filtrer</button> <!-- Recharge la page avec les choix. -->
      </form> <!-- Fin des filtres. -->
      <table> <!-- Résultats. -->
        <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Catégorie</th><th>Description</th></tr></thead> <!-- En-têtes. -->
        <tbody>${body || `<tr><td colspan="5">Aucune opération.</td></tr>`}</tbody> <!-- Lignes, ou une phrase sur 5 colonnes. -->
      </table>`; // Fin du tableau.
  } // Fin de render.
} // Fin de HistoryView.

export class StatsView { // Cartes du mois, graphique comparatif, tableau par catégorie.
  render({ summary, categories, series }) { // summary : totaux du mois. categories : dépenses par catégorie. series : six mois.
    const rows = categories.map((item) => `<tr><td>${escapeHtml(item.nom)}</td><td>${Money.format(item.total)}</td></tr>`).join(""); // Une ligne : nom et total.
    const top = categories[0]; // La première est la plus coûteuse, car la liste arrive déjà triée. Peut être absente.
    return /* cartes, graphique et tableau du mois */ `
      <section class="cards"> <!-- Quatre cartes. -->
        <article class="card"><p>Revenus du mois</p><strong class="pos">${Money.format(summary.revenus)}</strong></article> <!-- Revenus en vert. -->
        <article class="card"><p>Dépenses du mois</p><strong class="neg">${Money.format(summary.depenses)}</strong></article> <!-- Dépenses en rouge. -->
        <article class="card"><p>Solde du mois</p><strong class="${moneyClass(summary.solde)}">${Money.format(summary.solde)}</strong></article> <!-- Solde vert ou rouge selon le signe. -->
        <article class="card"><p>Catégorie la plus coûteuse</p><strong>${top ? escapeHtml(top.nom) : "—"}</strong><small>${top ? Money.format(top.total) : ""}</small></article> <!-- Nom et montant, ou un tiret s'il n'y a aucune dépense. -->
      </section> <!-- Fin des cartes. -->
      <div class="chart-card"> <!-- Cadre du graphique. -->
        <h2>Comparaison revenus et dépenses</h2> <!-- Titre. -->
        <canvas id="compare-chart"></canvas> <!-- Zone de dessin lue par charts.js. -->
      </div> <!-- Fin du cadre. -->
      ${jsonIsland("compare-series", { // Objet caché dans la page pour le graphique en barres.
        labels: series.map((item) => item.label), // Noms des mois.
        revenus: series.map((item) => item.revenus), // Totaux des revenus, même ordre.
        depenses: series.map((item) => item.depenses), // Totaux des dépenses, même ordre.
      })} <!-- Données cachées du graphique en barres. -->
      <h2>Dépenses par catégorie ce mois</h2> <!-- Titre du tableau. -->
      <div class="table-wrap"><table><thead><tr><th>Catégorie</th><th>Total</th></tr></thead><tbody>${rows || emptyRow(2, "Aucune dépense ce mois.")}</tbody></table></div>`; // Tableau, ou une phrase si la liste est vide.
  } // Fin de render.
} // Fin de StatsView.

export class NotificationView { // Liste des alertes.
  render(items) { // items est le tableau des notifications.
    if (!items.length) return "<p>Aucune notification.</p>"; // Liste vide : une seule phrase.
    return `<ul class="notes">${items.map((item) => /* une alerte */ `
      <li class="${item.statut_lecture ? "read" : ""}"> <!-- read grise le trait de gauche si le message était déjà lu. -->
        <strong>${escapeHtml(item.titre)}</strong> <!-- Titre de l'alerte. -->
        <p>${escapeHtml(item.message)}</p> <!-- Texte. -->
        <small>${escapeHtml(item.date_notification.replace("T", " ").slice(0, 16))}</small> <!-- Date et heure, sans les secondes. Le T de la date ISO est remplacé par un espace. -->
      </li>`).join("")}</ul>`; // Colle les éléments de liste.
  } // Fin de render.
} // Fin de NotificationView.

export class ProfileView { // Deux formulaires : identité, puis mot de passe.
  render({ user, profileErrors, passwordErrors }) { // user : valeurs actuelles. Les deux autres : erreurs éventuelles.
    return /* les deux formulaires côte à côte */ `
      <section class="split"> <!-- Deux colonnes. -->
        <form method="post" class="panel"> <!-- Identité, postée vers /profil. -->
          <h2>Profil</h2> <!-- Titre. -->
          ${errors(profileErrors)} <!-- Erreurs de ce formulaire. -->
          ${field("Nom", `<input name="nom" value="${escapeHtml(user.nom)}" required>`)} <!-- Nom actuel. -->
          ${field("Prénom", `<input name="prenom" value="${escapeHtml(user.prenom)}" required>`)} <!-- Prénom actuel. -->
          ${field("E-mail", `<input type="email" name="email" value="${escapeHtml(user.email)}" required>`)} <!-- E-mail actuel. type email demande une forme d'adresse. -->
          <button type="submit">Enregistrer</button> <!-- Envoie nom, prénom, e-mail. -->
        </form> <!-- Fin du profil. -->
        <form method="post" action="/profil/mot-de-passe" class="panel"> <!-- Mot de passe, adresse différente pour ne pas mélanger les deux envois. -->
          <h2>Mot de passe</h2> <!-- Titre. -->
          ${errors(passwordErrors)} <!-- Erreurs de ce formulaire. -->
          ${field("Mot de passe actuel", `<input type="password" name="actuel" required>`)} <!-- type password cache les caractères. On ne préremplit jamais un mot de passe. -->
          ${field("Nouveau mot de passe", `<input type="password" name="nouveau" required>`)} <!-- Nouveau mot. -->
          ${field("Confirmation", `<input type="password" name="confirmation" required>`)} <!-- Deuxième saisie, pour éviter une faute de frappe. -->
          <button type="submit">Modifier</button> <!-- Envoie les trois champs. -->
        </form> <!-- Fin du mot de passe. -->
      </section>`; // Fin des deux colonnes.
  } // Fin de render.
} // Fin de ProfileView.

export class AuthView { // Textes des pages publiques : accueil, inscription, connexion.
  home() { // Page d'accueil avant connexion.
    return /* titre et deux boutons */ `
      <h1>Dépenses</h1> <!-- Titre. -->
      <p>Suivez vos revenus, vos dépenses et vos budgets. Chaque compte reste privé.</p> <!-- Phrase d'explication. -->
      <div class="gate-actions"> <!-- Les deux boutons côte à côte. -->
        <a class="button" href="/inscription">Créer un compte</a> <!-- Lien vers l'inscription, habillé comme un bouton. -->
        <a class="button ghost" href="/connexion">Se connecter</a> <!-- Lien vers la connexion, bouton secondaire. -->
      </div>`; // Fin des boutons.
  } // Fin de home.

  register(formErrors, values = {}) { // Formulaire d'inscription. values est vide au premier affichage.
    return /* formulaire de création de compte */ `
      <h1>Créer un compte</h1> <!-- Titre. -->
      <form method="post" class="panel"> <!-- Envoi vers l'adresse actuelle, /inscription. -->
        ${errors(formErrors)} <!-- Erreurs de la tentative précédente. -->
        ${field("Nom", `<input name="nom" value="${escapeHtml(values.nom || "")}" required>`)} <!-- Nom, réaffiché s'il y a eu une erreur. -->
        ${field("Prénom", `<input name="prenom" value="${escapeHtml(values.prenom || "")}" required>`)} <!-- Prénom. -->
        ${field("E-mail", `<input type="email" name="email" value="${escapeHtml(values.email || "")}" required>`)} <!-- E-mail. -->
        ${field("Mot de passe", `<input type="password" name="mot_de_passe" required>`)} <!-- Mot de passe. Jamais réaffiché. -->
        ${field("Confirmation", `<input type="password" name="confirmation" required>`)} <!-- Deuxième saisie. -->
        <button type="submit">Créer le compte</button> <!-- Envoie le formulaire. -->
      </form> <!-- Fin du formulaire. -->
      <p class="switch">Déjà un compte ? <a href="/connexion">Se connecter</a></p>`; // Lien vers l'autre formulaire.
  } // Fin de register.

  login(formErrors, email = "") { // Formulaire de connexion. email est réaffiché après un échec.
    return /* formulaire de connexion */ `
      <h1>Connexion</h1> <!-- Titre. -->
      <p class="lede">Accédez à vos revenus, dépenses et budgets.</p> <!-- Phrase d'introduction. -->
      <form method="post" class="panel"> <!-- Envoi vers /connexion. -->
        ${errors(formErrors)} <!-- Message d'échec, s'il y en a un. -->
        ${field("E-mail", `<input type="email" name="email" value="${escapeHtml(email)}" required>`)} <!-- E-mail, gardé après un mauvais mot de passe. -->
        ${field("Mot de passe", `<input type="password" name="mot_de_passe" required>`)} <!-- Mot de passe, toujours vide. -->
        <button type="submit">Se connecter</button> <!-- Envoie le formulaire. -->
      </form> <!-- Fin du formulaire. -->
      <p class="switch">Pas encore de compte ? <a href="/inscription">S'inscrire</a></p>`; // Lien vers l'inscription.
  } // Fin de login.
} // Fin de AuthView.
