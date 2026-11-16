import { mesurer, exporterMesures } from "./mesures.js"; // Chronomètre des actions, et téléchargement du fichier des mesures.
import { readMeta, saveMeta } from "./stockage.js"; // Lecture et écriture des copies gardées dans le navigateur, pour le hors-ligne.

const app = document.querySelector("#app"); // La zone vide de index.html, là où tout l'écran sera écrit.
let user = null; // Compte connecté. null veut dire : personne n'est connecté pour l'instant.

if ("serviceWorker" in navigator) { // Le navigateur sait-il gérer un service worker (le programme de cache) ?
  navigator.serviceWorker.register("/sw.js"); // On enregistre sw.js. S'il est déjà enregistré, le navigateur le réutilise.
} // Fin de l'enregistrement. S'il n'y a pas de service worker, on continue sans cache.

const routes = { // Tableau de correspondance : adresse après le #, et fonction qui dessine la page.
  "/": renderTableau, // Tableau de bord.
  "/revenus": () => renderOperations("revenus"), // Page des revenus. La flèche appelle la fonction avec le bon mot.
  "/depenses": () => renderOperations("depenses"), // Page des dépenses, même fonction.
  "/categories": renderCategories, // Page des catégories.
  "/budgets": renderBudgets, // Page des budgets.
  "/historique": renderHistorique, // Page de l'historique.
  "/statistiques": renderStats, // Page des statistiques.
  "/notifications": renderNotifications, // Page des notifications.
  "/profil": renderProfil, // Page du profil.
  "/connexion": renderConnexion, // Formulaire de connexion.
  "/inscription": renderInscription, // Formulaire de création de compte.
}; // Fin de la table des pages.

window.addEventListener("hashchange", draw); // Quand le # de l'adresse change, on redessine la page. Le # évite de recharger tout le site.
document.addEventListener("click", (event) => { // On écoute tous les clics de la page.
  const link = event.target.closest("[data-route]"); // On remonte jusqu'au lien qui a l'attribut data-route, s'il y en a un.
  if (!link) return; // Clic ailleurs : on ne fait rien.
  event.preventDefault(); // On empêche le navigateur de suivre le lien tout seul.
  location.hash = link.dataset.route; // On change le # , ce qui déclenche hashchange puis draw.
}); // Fin de l'écoute des clics de navigation.

draw(); // Premier affichage, au chargement.

function currentRoute() { // Lit la page demandée dans le # de l'adresse.
  const raw = location.hash.slice(1) || "/"; // Enlève le caractère #. S'il n'y a rien, on prend la racine /.
  return raw.split("?")[0] || "/"; // On retire ?periode= ou ?q= : la route est seulement le chemin. split coupe le texte.
} // Fin de la lecture de la route.

async function draw() { // Choisit et affiche la bonne page. async car on peut attendre le serveur.
  const route = currentRoute(); // Chemin actuel, par exemple /depenses.
  if (!user && route !== "/connexion" && route !== "/inscription") { // Pas encore de compte en mémoire, et la page n'est pas un formulaire public.
    const session = await api("/api/session"); // On demande au serveur si une session existe déjà.
    user = session.user; // Compte, ou null.
  } // Fin de la récupération de session.
  if (!user && route !== "/connexion" && route !== "/inscription") { // Toujours personne, et page privée.
    location.hash = "/connexion"; // On envoie vers la connexion. Ce changement rappellera draw.
    return; // On ne dessine pas la page privée.
  } // Fin de la redirection.
  const view = routes[route] || renderTableau; // Fonction de la route, ou le tableau de bord si le chemin est inconnu.
  await view(); // On lance cette fonction et on attend qu'elle ait fini d'écrire la page.
} // Fin du choix de page.

async function api(url, options = {}) { // Appelle une adresse du serveur. options peut contenir la méthode, le corps et le nom de la mesure.
  const { mesure, body, ...rest } = options; // On sort mesure et body. rest garde le reste (par exemple method).
  const response = await mesurer(mesure || `${rest.method || "GET"} ${url}`, () => fetch(url, { // On chronomètre l'appel. fetch envoie la demande.
    credentials: "same-origin", // Envoie le cookie de session, mais seulement vers notre propre site.
    headers: { "content-type": "application/json" }, // On annonce que le corps est du JSON.
    ...rest, // Ajoute method et les autres options.
    body: body ? JSON.stringify(body) : undefined, // Transforme l'objet en texte JSON. Pas de corps si body est vide.
  })); // Fin de l'appel chronométré. response est la réponse brute.
  const data = await response.json().catch(() => ({})); // On lit le JSON. Si ce n'est pas du JSON, on prend un objet vide au lieu de planter.
  if (!response.ok) throw Object.assign(new Error("api"), { status: response.status, data }); // Réponse d'erreur (401, 422, etc.) : on lance une erreur qui porte le code et les messages.
  return data; // Réponse réussie : on renvoie les données.
} // Fin de l'appel au serveur.

const NAV = [ // Liens du menu principal. Chaque ligne : adresse, nom d'icône, texte affiché.
  ["/", "grid_view", "Tableau de bord"], // Accueil.
  ["/revenus", "trending_up", "Revenus"], // Revenus.
  ["/depenses", "trending_down", "Dépenses"], // Dépenses.
  ["/categories", "category", "Catégories"], // Catégories.
  ["/budgets", "pie_chart", "Budgets"], // Budgets.
  ["/historique", "receipt_long", "Historique"], // Historique.
  ["/statistiques", "monitoring", "Statistiques"], // Statistiques.
]; // Fin du menu principal. Notifications et Profil sont ajoutés plus bas.

function icon(name) { // Fabrique le HTML d'une icône à partir de son nom.
  return `<span class="material-symbols-outlined">${name}</span>`; // La police d'icônes affiche le symbole dont le texte est ce nom.
} // Fin de l'icône.

function shell(title, content, unread = 0) { // Cadre commun : menu, barre du haut, puis le contenu. unread est le nombre de notifications non lues.
  const route = currentRoute(); // Pour savoir quel lien du menu marquer comme actif.
  if (!user) { // Page de connexion ou d'inscription : pas de menu.
    app.innerHTML = `<div class="gate"><a class="gate-brand" data-route="/connexion" href="#/connexion">${icon("account_balance_wallet")} Dépenses</a><section class="gate-card">${content}</section></div>`; // Écran centré : nom de l'application et le formulaire reçu dans content.
    return; // On ne construit pas le menu.
  } // Fin de l'écran sans menu.
  const initial = escapeHtml(`${user.prenom?.[0] || ""}${user.nom?.[0] || ""}`.toUpperCase()); // Initiales : première lettre du prénom et du nom, en majuscules. ?. évite une erreur si le prénom manque. escapeHtml protège l'affichage.
  const link = ([href, glyph, label]) => { // Fabrique un lien de menu. Les crochets récupèrent les trois cases du tableau.
    const badge = href === "/notifications" && unread ? `<span class="badge">${unread}</span>` : ""; // Pastille seulement sur Notifications, et seulement s'il y a des messages non lus.
    const active = route === href ? "active" : ""; // Classe active si ce lien est la page affichée.
    return `<a class="${active}" data-route="${href}" href="#${href}">${icon(glyph)}<span>${label}</span>${badge}</a>`; // Lien cliquable avec icône, texte et pastille éventuelle.
  }; // Fin de la fabrication d'un lien.
  // On remplace tout le contenu de #app par le menu et la zone de travail.
  app.innerHTML = `
    <div class="shell"> <!-- écran connecté -->
      <aside> <!-- colonne de gauche -->
        <a class="brand" data-route="/" href="#/">${icon("account_balance_wallet")}<span><strong>Dépenses</strong><small>Finances personnelles</small></span></a> <!-- titre qui ramène au tableau de bord -->
        <p class="nav-label">Navigation</p> <!-- étiquette du premier groupe -->
        <nav>${NAV.map(link).join("")}</nav> <!-- les sept liens du menu, collés les uns aux autres -->
        <p class="nav-label">Compte</p> <!-- étiquette du second groupe -->
        <nav> <!-- liens du compte -->
          ${link(["/notifications", "notifications", "Notifications"])} <!-- lien Notifications, avec pastille si besoin -->
          ${link(["/profil", "person", "Profil"])} <!-- lien Profil -->
        </nav> <!-- fin des liens du compte -->
        <button id="logout" type="button">${icon("logout")}<span>Déconnexion</span></button> <!-- bouton de déconnexion -->
        <button id="export" class="ghost" type="button">Exporter les mesures</button> <!-- télécharge mesures.csv -->
        <div class="account"><span class="avatar">${initial}</span><p><strong>${escapeHtml(user.prenom)} ${escapeHtml(user.nom)}</strong><small>${escapeHtml(user.email)}</small></p></div> <!-- initiales, nom et e-mail en bas du menu -->
      </aside> <!-- fin du menu -->
      <div class="workspace"> <!-- zone de droite -->
        <header class="topbar"> <!-- barre du haut -->
          <p>Finances personnelles <span>/</span> ${escapeHtml(title)}</p> <!-- fil d'Ariane : le titre reçu en argument -->
          <form class="top-search" id="search">${icon("search")}<input name="q" placeholder="Rechercher une dépense" aria-label="Rechercher une dépense"></form> <!-- recherche. aria-label nomme le champ pour les lecteurs d'écran -->
          <a class="bell" data-route="/notifications" href="#/notifications" aria-label="Notifications">${icon("notifications")}${unread ? `<i>${unread}</i>` : ""}</a> <!-- cloche. La balise i reçoit le nombre s'il y a des messages non lus -->
        </header> <!-- fin de la barre -->
        <main>${content}</main> <!-- contenu propre à la page -->
      </div> <!-- fin de la zone de droite -->
    </div>`; // Fin du HTML injecté.
  document.querySelector("#logout").onclick = async () => { // Clic sur Déconnexion.
    await api("/api/deconnexion", { method: "POST", mesure: "deconnexion" }); // Demande au serveur de détruire la session.
    user = null; // Oublie le compte dans la page.
    location.hash = "/connexion"; // Retour au formulaire de connexion.
  }; // Fin du clic Déconnexion.
  document.querySelector("#export").onclick = () => exporterMesures(); // Clic sur Exporter : télécharge le CSV des mesures.
  document.querySelector("#search").onsubmit = (event) => { // Envoi du formulaire de recherche.
    event.preventDefault(); // Empêche le rechargement de la page.
    const q = new FormData(event.target).get("q"); // Lit le texte du champ nommé q.
    location.hash = `/depenses?q=${encodeURIComponent(q || "")}`; // Ouvre les dépenses avec ce mot. encodeURIComponent rend le texte sûr dans une adresse.
  }; // Fin de la recherche.
} // Fin du cadre commun.

async function renderConnexion() { // Dessine le formulaire de connexion.
  shell("", ` <!-- pas de titre de barre : l'utilisateur n'est pas dans le menu -->
    <p class="auth-kicker">Dépenses</p> <!-- pastille au-dessus du titre -->
    <h1>Connexion à votre espace</h1> <!-- titre -->
    <p class="lede">Accédez à vos revenus, vos dépenses et vos budgets.</p> <!-- phrase d'explication -->
    <form id="form" class="panel plain"> <!-- formulaire sans cadre supplémentaire -->
      <p class="errors" style="display:none"></p> <!-- zone d'erreurs, cachée tant qu'il n'y en a pas -->
      <label class="field">Adresse e-mail<input name="email" type="email" autocomplete="username" required></label> <!-- e-mail obligatoire. autocomplete aide le navigateur à proposer le compte -->
      <label class="field">Mot de passe<span class="secret"><input name="mot_de_passe" type="password" autocomplete="current-password" required><button type="button" class="reveal" aria-label="Afficher le mot de passe">voir</button></span></label> <!-- mot de passe masqué, avec un bouton pour le montrer -->
      <button type="submit">Se connecter</button> <!-- envoi du formulaire -->
    </form> <!-- fin du formulaire -->
    <p class="switch">Pas encore de compte ? <a data-route="/inscription" href="#/inscription">Créer un compte</a></p>`); // lien vers l'inscription. Fin du HTML.
  bindAuth("/api/connexion"); // Branche l'envoi du formulaire sur l'adresse de connexion.
} // Fin de la page de connexion.

async function renderInscription() { // Dessine le formulaire de création de compte.
  shell("", ` <!-- écran public, sans menu -->
    <div class="auth-split"> <!-- deux colonnes : formulaire et explication -->
      <div> <!-- colonne du formulaire -->
        <p class="auth-kicker">Dépenses</p> <!-- pastille -->
        <h1>Créer un compte personnel</h1> <!-- titre -->
        <p class="lede">Le compte est privé. Personne d'autre ne voit vos opérations.</p> <!-- phrase d'explication -->
        <form id="form" class="panel plain"> <!-- formulaire -->
          <p class="errors" style="display:none"></p> <!-- erreurs cachées au départ -->
          <div class="pair"> <!-- nom et prénom côte à côte -->
            <label class="field">Nom<input name="nom" autocomplete="family-name" required></label> <!-- nom obligatoire -->
            <label class="field">Prénom<input name="prenom" autocomplete="given-name" required></label> <!-- prénom obligatoire -->
          </div> <!-- fin de la paire -->
          <label class="field">Adresse e-mail<input name="email" type="email" autocomplete="email" required></label> <!-- e-mail obligatoire -->
          <label class="field">Mot de passe<span class="hint">8 caractères minimum</span><span class="secret"><input name="mot_de_passe" type="password" minlength="8" autocomplete="new-password" required><button type="button" class="reveal" aria-label="Afficher le mot de passe">voir</button></span><i class="meter"></i></label> <!-- mot de passe, bouton voir, et barre de longueur -->
          <label class="field">Confirmation<input name="confirmation" type="password" autocomplete="new-password" required></label> <!-- deuxième saisie du mot de passe -->
          <button type="submit">Créer le compte</button> <!-- envoi -->
        </form> <!-- fin du formulaire -->
        <p class="switch">Déjà un compte ? <a data-route="/connexion" href="#/connexion">Se connecter</a></p> <!-- lien vers la connexion -->
      </div> <!-- fin de la colonne formulaire -->
      <aside class="auth-aside"> <!-- colonne d'explication. Ce aside n'est pas le menu. -->
        <p class="kicker">Votre espace</p> <!-- petite étiquette -->
        <h2>Ce que le compte protège</h2> <!-- titre de la colonne -->
        <ul> <!-- liste -->
          <li><strong>Données isolées.</strong> Chaque utilisateur ne consulte que ses opérations.</li> <!-- isolation des comptes -->
          <li><strong>Mot de passe hashé.</strong> Il n'est jamais enregistré en clair.</li> <!-- hashé = transformé en empreinte illisible -->
          <li><strong>Solde automatique.</strong> Revenus moins dépenses, après chaque opération.</li> <!-- calcul du solde -->
        </ul> <!-- fin de la liste -->
      </aside> <!-- fin de la colonne d'explication -->
    </div>`); // Fin du HTML d'inscription.
  const password = document.querySelector("[name=mot_de_passe]"); // Le champ du mot de passe, juste après l'écriture du HTML.
  const meter = document.querySelector(".meter"); // La barre de longueur.
  password.addEventListener("input", () => { // À chaque frappe dans le mot de passe.
    const length = password.value.length; // Nombre de caractères déjà tapés.
    meter.style.setProperty("--level", `${Math.min(100, length / 8 * 100)}%`); // Largeur de la barre : 100 % à partir de 8 caractères. Math.min empêche de dépasser 100.
    meter.dataset.state = length >= 8 ? "ok" : "short"; // ok rend la barre verte dans le CSS. short la laisse orange.
  }); // Fin de la mise à jour de la barre.
  bindAuth("/api/inscription"); // Branche l'envoi sur l'adresse d'inscription.
} // Fin de la page d'inscription.

function bindAuth(url) { // Actions communes aux deux formulaires. url est /api/connexion ou /api/inscription.
  document.querySelectorAll(".reveal").forEach((button) => { // Chaque bouton « voir ».
    button.onclick = () => { // Au clic.
      const input = button.parentElement.querySelector("input"); // Le champ qui est dans la même enveloppe que le bouton.
      const shown = input.type === "text"; // Vrai si le mot de passe est déjà visible.
      input.type = shown ? "password" : "text"; // On masque ou on affiche.
      button.textContent = shown ? "voir" : "masquer"; // Le libellé du bouton suit l'état.
    }; // Fin du clic voir / masquer.
  }); // Fin de la boucle sur les boutons.
  document.querySelector("#form").onsubmit = async (event) => { // Envoi du formulaire.
    event.preventDefault(); // Pas de rechargement.
    const body = Object.fromEntries(new FormData(event.target)); // Transforme les champs en objet { nom du champ : valeur }.
    try { // On tente l'appel. En cas d'erreur du serveur, on passe dans catch.
      const data = await api(url, { method: "POST", body, mesure: url }); // Envoie le formulaire. Le nom de la mesure est l'adresse appelée.
      user = data.user; // Le serveur renvoie le compte : on le garde.
      location.hash = "/"; // Ouverture du tableau de bord.
    } catch (error) { // Le serveur a refusé (e-mail déjà pris, mot de passe trop court, etc.).
      const box = document.querySelector(".errors"); // La zone d'erreurs du formulaire.
      box.style.display = "grid"; // On l'affiche. Elle était en display:none.
      box.innerHTML = (error.data?.errors || ["Échec de l'opération."]).map((item) => `<span>${escapeHtml(item)}</span>`).join(""); // Un span par message. Si le serveur n'a pas envoyé de liste, on met une phrase de repli.
    } // Fin de l'affichage des erreurs.
  }; // Fin de l'envoi.
} // Fin des branchements d'authentification.

async function renderTableau() { // Dessine le tableau de bord.
  let data; // Les chiffres, remplis soit par le serveur, soit par la copie locale.
  try { // On tente le réseau.
    const query = location.hash.includes("?") ? location.hash.slice(location.hash.indexOf("?")) : ""; // Si l'adresse a ?periode=mois, on reprend cette partie. Sinon, texte vide.
    data = await api(`/api/tableau${query}`); // Demande les chiffres. La période suit dans l'adresse.
    await saveMeta("tableau", data); // Garde une copie dans le navigateur.
  } catch (error) { // Réseau ou serveur indisponible. error n'est pas réutilisé : on se rabat sur la copie.
    data = await readMeta("tableau"); // Dernière copie connue.
    if (!data) return offlineMessage(); // Jamais ouvert en ligne : on explique qu'il n'y a rien en cache.
  } // Fin du chargement des chiffres.
  const cards = [ // Quatre cartes : libellé, valeur déjà en texte, classe de couleur.
    ["Solde actuel", money(data.soldeActuel), ""], // Solde de tout l'historique, sans couleur forcée.
    [`Revenus · ${data.rangeLabel}`, money(data.summary.revenus), "pos"], // Revenus de la période, en vert.
    [`Dépenses · ${data.rangeLabel}`, money(data.summary.depenses), "neg"], // Dépenses de la période, en rouge.
    ["Budget disponible", data.budgetDisponible === null ? "Aucun budget" : money(data.budgetDisponible), data.budgetDisponible < 0 ? "neg" : "pos"], // Reste du budget, ou la phrase « Aucun budget ». Rouge seulement si le reste est négatif.
  ].map(([label, value, tone]) => `<article class="card"><p>${escapeHtml(label)}</p><strong class="${tone}">${value}</strong></article>`).join(""); // Chaque trio devient une carte, puis on colle les cartes.
  const periods = ["jour", "semaine", "mois", "annee"].map((value) => { // Un lien par période.
    const label = { jour: "Journée", semaine: "Semaine", mois: "Mois", annee: "Année" }[value]; // Texte du bouton selon le mot technique.
    return `<a class="${data.rangeName === value ? "on" : ""}" href="#/?periode=${value}">${label}</a>`; // Classe on si c'est la période affichée. Le lien remet le # avec ?periode=.
  }).join(""); // Colle les quatre liens.
  const rows = (data.recent || []).map((op) => { // Lignes des dernières opérations. || [] évite une erreur si la liste manque.
    const expense = op.kind === "Dépense"; // Vrai pour une dépense, faux pour un revenu.
    return `<tr><td>${escapeHtml(op.date)}</td><td><span class="pill ${expense ? "depense" : "revenu"}">${escapeHtml(op.kind)}</span></td><td>${escapeHtml(op.label)}</td><td class="num ${expense ? "neg" : "pos"}">${expense ? "−" : "+"}${money(op.montant)}</td></tr>`; // Date, pastille, libellé, montant signé.
  }).join(""); // Colle les lignes.
  const budgets = (data.budgets || []).map((item) => { // Cartes des budgets en cours.
    const ratio = Math.min(100, Math.round((item.spent / item.limit) * 100)); // Pourcentage dépensé, plafonné à 100 pour la largeur de la barre.
    return `<article class="card ${item.level}"><p>${escapeHtml(item.nom)}</p><strong>${money(item.remaining)} restants</strong><div class="progress"><i style="width:${ratio}%"></i></div><small>${money(item.spent)} dépensés sur ${money(item.limit)}</small></article>`; // Nom, reste, barre, et le rappel dépensé / plafond.
  }).join(""); // Colle les cartes de budget.
  shell("Tableau de bord", ` <!-- titre de la barre, puis le HTML de la page -->
    <div class="page-title"><div><p class="kicker">Aperçu</p><h1>Tableau de bord</h1></div><nav class="segment">${periods}</nav></div> <!-- titre et boutons de période -->
    <section class="cards">${cards}</section> <!-- les quatre chiffres -->
    <section class="split"> <!-- opérations à gauche, graphique à droite -->
      <div class="table-wrap"><h2>Dernières opérations</h2><table><thead><tr><th>Date</th><th>Type</th><th>Libellé</th><th>Montant</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Aucune opération.</td></tr>`}</tbody></table></div> <!-- tableau. colspan 4 fusionne les quatre colonnes pour le message vide -->
      <div class="chart-card"><h2>Évolution des dépenses</h2><canvas id="spend-chart"></canvas></div> <!-- toile vide : Chart.js dessinera dedans -->
    </section> <!-- fin des deux colonnes -->
    <h2>Budgets en cours</h2> <!-- titre de la section -->
    <section class="cards">${budgets || `<p class="empty">Aucun budget en cours.</p>`}</section>`, data.unread || 0); // Cartes de budgets, ou phrase vide. Le troisième argument est le nombre de notifications.
  const labels = (data.series || []).map((item) => item.label); // Noms des mois pour l'axe du graphique.
  const values = (data.series || []).map((item) => item.total); // Total dépensé de chaque mois.
  const canvas = document.getElementById("spend-chart"); // La toile, maintenant qu'elle est dans la page.
  if (canvas && window.Chart) { // On dessine seulement si la toile existe et si la bibliothèque Chart est chargée.
    new Chart(canvas, { // Crée le graphique.
      type: "line", // Courbe.
      data: { labels, datasets: [{ data: values, borderColor: "#1d4ed8", backgroundColor: "rgba(29,78,216,.12)", fill: true, tension: 0.35, pointRadius: 3 }] }, // Mois, montants, trait bleu, fond bleu léger, courbe un peu arrondie, petits points.
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }, // S'adapte à la carte, pas de légende, l'axe vertical part de zéro.
    }); // Fin de la création du graphique.
  } // Fin du dessin. S'il manque Chart, la toile reste vide.
} // Fin du tableau de bord.

async function renderOperations(kind) { // Page revenus ou dépenses. kind vaut "revenus" ou "depenses".
  const isIncome = kind === "revenus"; // Vrai sur la page des revenus.
  const query = location.hash.includes("q=") ? location.hash.slice(location.hash.indexOf("?")) : ""; // Reprend ?q=... seulement pour une recherche. Les revenus ignorent cette chaîne plus bas.
  let rows = []; // Opérations à afficher.
  let cats = []; // Catégories pour la liste déroulante.
  try { // On tente le réseau.
    const [data, categoryData] = await Promise.all([ // Les deux demandes partent en même temps. On attend les deux.
      api(`/api/${kind}${isIncome ? "" : query}`), // /api/revenus, ou /api/depenses plus le filtre de recherche.
      api(`/api/categories?type=${isIncome ? "revenu" : "depense"}`), // Catégories du bon type.
    ]); // Fin des deux demandes.
    rows = data[kind] || data.revenus || data.depenses; // La liste porte le nom de la page. Les deux autres noms sont un repli.
    cats = categoryData.categories; // Liste des catégories.
    await saveMeta(kind, rows); // Copie locale des opérations. Les catégories ne sont pas copiées ici.
  } catch { // Hors ligne ou erreur.
    rows = await readMeta(kind); // Dernière copie des opérations.
    if (!rows) return offlineMessage(); // Rien en cache : message d'explication. La liste de catégories restera vide.
  } // Fin du chargement.
  const options = cats.map((item) => `<option value="${item.id_categorie}">${escapeHtml(item.nom_categorie)}</option>`).join(""); // Une option de liste par catégorie. value est le numéro envoyé au serveur.
  const payments = ["Espèces", "Carte", "Mobile money", "Virement", "Autre"].map((item) => `<option>${item}</option>`).join(""); // Moyens de paiement proposés. Sans value, le texte de l'option est la valeur envoyée.
  const body = rows.map((row) => { // Une ligne de tableau par opération.
    const expense = !isIncome; // Vrai sur la page des dépenses.
    const id = row.id_revenu || row.id_depense; // Numéro à envoyer pour supprimer.
    return `<tr> <!-- une opération -->
      <td>${escapeHtml(row.date_revenu || row.date_depense)}</td> <!-- date, selon le type -->
      <td class="num ${expense ? "neg" : "pos"}">${expense ? "−" : "+"}${money(row.montant)}</td> <!-- montant signé -->
      <td>${escapeHtml(row.source || row.nom_categorie || "—")}</td> <!-- source du revenu, ou catégorie de la dépense -->
      <td>${escapeHtml(row.nom_categorie && row.source ? row.nom_categorie : row.moyen_paiement || "—")}</td> <!-- pour un revenu qui a une source : la catégorie. Pour une dépense : le paiement -->
      <td>${escapeHtml(row.description || "")}</td> <!-- description, ou rien -->
      <td class="actions"><button class="danger" data-delete="${id}" type="button">Supprimer</button></td> <!-- bouton qui porte le numéro dans data-delete -->
    </tr>`; // Fin de la ligne.
  }).join(""); // Colle toutes les lignes.
  shell(isIncome ? "Revenus" : "Dépenses", ` <!-- titre selon la page -->
    <section class="split"> <!-- formulaire à gauche, tableau à droite -->
      <form id="form" class="panel"> <!-- formulaire de saisie -->
        <h2>${isIncome ? "Enregistrer un revenu" : "Enregistrer une dépense"}</h2> <!-- titre du formulaire -->
        <p class="errors" style="display:none"></p> <!-- erreurs cachées -->
        <label class="field">Montant<input name="montant" inputmode="decimal" required></label> <!-- montant. inputmode decimal propose un clavier numérique sur téléphone -->
        ${isIncome /* on choisit les champs selon la page */
          ? `<label class="field">Source<input name="source" required></label><label class="field">Catégorie<select name="categorie"><option value="">Aucune</option>${options}</select></label>` /* revenu : source obligatoire, catégorie facultative */
          : `<label class="field">Catégorie<select name="categorie" required><option value="">Choisir</option>${options}</select></label><label class="field">Moyen de paiement<select name="moyen_paiement">${payments}</select></label>` /* dépense : catégorie obligatoire et moyen de paiement */}
        <label class="field">Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label> <!-- date du jour déjà remplie -->
        <label class="field">Description<input name="description"></label> <!-- précision facultative -->
        <button type="submit">Enregistrer</button> <!-- envoi -->
      </form> <!-- fin du formulaire -->
      <div class="table-wrap"> <!-- tableau -->
        <h2>${isIncome ? "Revenus enregistrés" : "Dépenses enregistrées"}</h2> <!-- titre du tableau -->
        <table> <!-- grille -->
          <thead><tr><th>Date</th><th>Montant</th><th>${isIncome ? "Source" : "Catégorie"}</th><th>${isIncome ? "Catégorie" : "Paiement"}</th><th>Description</th><th></th></tr></thead> <!-- en-têtes. La dernière colonne est celle du bouton, sans titre -->
          <tbody>${body || `<tr><td class="empty" colspan="6">Aucune opération.</td></tr>`}</tbody> <!-- lignes, ou une phrase si la liste est vide -->
        </table> <!-- fin de la grille -->
      </div> <!-- fin du tableau -->
    </section>`); // Fin du HTML de la page.
  document.querySelector("#form").onsubmit = async (event) => { // Envoi du formulaire d'opération.
    event.preventDefault(); // Pas de rechargement.
    const body = Object.fromEntries(new FormData(event.target)); // Champs en objet.
    try { // On tente l'enregistrement.
      await api(`/api/${kind}`, { method: "POST", body, mesure: `creer ${kind}` }); // POST vers /api/revenus ou /api/depenses.
      renderOperations(kind); // On redessine la page pour voir la nouvelle ligne.
    } catch (error) { // Le serveur a refusé, ou on est hors ligne.
      const box = document.querySelector(".errors"); // Zone d'erreurs.
      box.style.display = "grid"; // On l'affiche.
      box.textContent = (error.data?.errors || ["Enregistrement impossible hors ligne."]).join(" "); // Messages collés dans une seule phrase. textContent évite d'interpréter le texte comme du HTML.
    } // Fin de l'erreur.
  }; // Fin de l'envoi.
  document.querySelectorAll("[data-delete]").forEach((button) => { // Chaque bouton Supprimer.
    button.onclick = async () => { // Au clic.
      if (!confirm("Supprimer cette opération ?")) return; // confirm ouvre la boîte oui/non du navigateur. Non : on s'arrête.
      await api(`/api/${kind}/${button.dataset.delete}/supprimer`, { method: "POST", mesure: `supprimer ${kind}` }); // Adresse avec le numéro de la ligne.
      renderOperations(kind); // On redessine sans la ligne supprimée.
    }; // Fin du clic supprimer.
  }); // Fin de la boucle sur les boutons.
} // Fin de la page revenus / dépenses.

async function renderCategories() { // Dessine la page des catégories.
  let data; // Réponse, ou une forme reconstruite depuis le cache.
  try { // Réseau.
    data = await api("/api/categories"); // Toutes les catégories visibles, revenus et dépenses.
    await saveMeta("categories", data.categories); // Copie de la liste seule.
  } catch { // Hors ligne.
    const cached = await readMeta("categories"); // Copie locale.
    if (!cached) return offlineMessage(); // Rien en cache.
    data = { categories: cached }; // On remet la liste dans la même forme que la réponse du serveur.
  } // Fin du chargement.
  const rows = data.categories.map((item) => `<tr><td>${escapeHtml(item.nom_categorie)}</td><td><span class="pill ${item.type_categorie}">${item.type_categorie === "revenu" ? "Revenu" : "Dépense"}</span></td><td>${item.id_utilisateur ? "Personnelle" : "Prédéfinie"}</td></tr>`).join(""); // Nom, pastille, et origine. Sans id_utilisateur, la catégorie est fournie par l'application.
  shell("Catégories", ` <!-- titre -->
    <section class="split"> <!-- formulaire et tableau -->
      <form id="form" class="panel"> <!-- création -->
        <h2>Nouvelle catégorie</h2> <!-- titre du formulaire -->
        <p class="errors" style="display:none"></p> <!-- erreurs cachées -->
        <label class="field">Nom<input name="nom" required></label> <!-- nom obligatoire -->
        <label class="field">Type<select name="type"><option value="depense">Dépense</option><option value="revenu">Revenu</option></select></label> <!-- type, dépense par défaut -->
        <button type="submit">Créer</button> <!-- envoi -->
      </form> <!-- fin du formulaire -->
      <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Type</th><th>Origine</th></tr></thead><tbody>${rows}</tbody></table></div> <!-- liste. S'il n'y a aucune catégorie, le tableau reste vide : le serveur en crée au démarrage -->
    </section>`); // Fin du HTML.
  document.querySelector("#form").onsubmit = async (event) => { // Envoi.
    event.preventDefault(); // Pas de rechargement.
    try { // On tente la création.
      await api("/api/categories", { method: "POST", body: Object.fromEntries(new FormData(event.target)), mesure: "categorie" }); // Envoie nom et type.
      renderCategories(); // Redessine pour montrer la nouvelle ligne.
    } catch (error) { // Nom trop court, doublon, ou hors ligne.
      const box = document.querySelector(".errors"); // Zone d'erreurs.
      box.style.display = "grid"; // On l'affiche.
      box.textContent = (error.data?.errors || ["Création impossible."]).join(" "); // Messages, ou phrase de repli.
    } // Fin de l'erreur.
  }; // Fin de l'envoi.
} // Fin de la page catégories.

async function renderBudgets() { // Dessine la page des budgets.
  let data; // Réponse ou copie.
  try { // Réseau.
    data = await api("/api/budgets"); // Budgets avec dépensé, reste et niveau.
    await saveMeta("budgets", data.budgets); // Copie locale.
  } catch { // Hors ligne.
    const cached = await readMeta("budgets"); // Copie.
    if (!cached) return offlineMessage(); // Rien en cache.
    data = { budgets: cached }; // Même forme que la réponse du serveur.
  } // Fin du chargement.
  const rows = data.budgets.map((item) => { // Une ligne par budget.
    const ratio = Math.min(100, Math.round(((item.spent || 0) / item.montant_limite) * 100)); // Pourcentage. spent peut manquer dans une vieille copie : on met 0.
    const label = item.level === "depasse" ? "Dépassé" : item.level === "proche" ? "Proche" : "Dans la limite"; // Texte de l'état. Tout ce qui n'est ni depasse ni proche s'affiche « Dans la limite ».
    return `<tr><td>${escapeHtml(item.nom_categorie || "Budget global")}</td><td>${money(item.montant_limite)}</td><td>${money(item.spent)}</td><td class="${item.remaining < 0 ? "neg" : "pos"}">${money(item.remaining)}</td><td><div class="progress"><i style="width:${ratio}%"></i></div></td><td><span class="pill ${item.level || "ok"}">${label}</span></td></tr>`; // Nom, plafond, dépensé, reste coloré, barre, pastille.
  }).join(""); // Colle les lignes.
  const month = new Date(); // Aujourd'hui, pour proposer le mois en cours dans le formulaire.
  const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().slice(0, 10); // Premier jour du mois, en année-mois-jour.
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10); // Dernier jour du mois. Le jour 0 du mois suivant est le dernier jour de celui-ci.
  shell("Budgets", ` <!-- titre -->
    <section class="split"> <!-- formulaire et tableau -->
      <form id="form" class="panel"> <!-- création d'un budget -->
        <h2>Définir un budget</h2> <!-- titre -->
        <p class="errors" style="display:none"></p> <!-- erreurs cachées -->
        <label class="field">Montant limite<input name="montant" required></label> <!-- plafond -->
        <label class="field">Catégorie<select name="categorie" id="budget-cat"><option value="">Budget global</option></select></label> <!-- vide = toutes les dépenses. Les options arrivent juste après -->
        <label class="field">Début<input type="date" name="date_debut" value="${start}" required></label> <!-- date de début, mois en cours -->
        <label class="field">Fin<input type="date" name="date_fin" value="${end}" required></label> <!-- date de fin -->
        <button type="submit">Enregistrer le budget</button> <!-- envoi -->
      </form> <!-- fin du formulaire -->
      <div class="table-wrap"><table><thead><tr><th>Budget</th><th>Limite</th><th>Dépensé</th><th>Restant</th><th></th><th>État</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Aucun budget.</td></tr>`}</tbody></table></div> <!-- liste. La colonne sans titre est la barre -->
    </section>`); // Fin du HTML.
  api("/api/categories?type=depense").then((result) => { // Charge les catégories de dépense après l'affichage. then = quand la réponse arrive.
    const select = document.querySelector("#budget-cat"); // La liste déroulante.
    if (!select) return; // Si l'utilisateur a déjà changé de page, la liste n'existe plus : on abandonne.
    select.insertAdjacentHTML("beforeend", result.categories.map((item) => `<option value="${item.id_categorie}">${escapeHtml(item.nom_categorie)}</option>`).join("")); // Ajoute les options à la fin, après « Budget global ».
  }).catch(() => {}); // Si cet appel échoue, on laisse seulement « Budget global ». L'accolade vide ignore l'erreur.
  document.querySelector("#form").onsubmit = async (event) => { // Envoi du budget.
    event.preventDefault(); // Pas de rechargement.
    try { // On tente l'enregistrement.
      await api("/api/budgets", { method: "POST", body: Object.fromEntries(new FormData(event.target)), mesure: "budget" }); // Envoie plafond, catégorie et dates.
      renderBudgets(); // Redessine la liste.
    } catch (error) { // Montant ou dates refusés, ou hors ligne.
      const box = document.querySelector(".errors"); // Zone d'erreurs.
      box.style.display = "grid"; // On l'affiche.
      box.textContent = (error.data?.errors || ["Enregistrement impossible."]).join(" "); // Messages, ou phrase de repli.
    } // Fin de l'erreur.
  }; // Fin de l'envoi.
} // Fin de la page budgets.

async function renderHistorique() { // Dessine tout l'historique, revenus et dépenses ensemble.
  let data; // Réponse ou copie.
  try { // Réseau.
    data = await api("/api/historique?periode=tout"); // periode=tout : pas de limite de dates. La page ne propose pas d'autre filtre.
    await saveMeta("historique", data.operations); // Copie de la liste.
  } catch { // Hors ligne.
    const cached = await readMeta("historique"); // Copie.
    if (!cached) return offlineMessage(); // Rien en cache.
    data = { operations: cached }; // Même forme que la réponse.
  } // Fin du chargement.
  const rows = data.operations.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td><span class="pill ${row.kind === "Dépense" ? "depense" : "revenu"}">${escapeHtml(row.kind)}</span></td><td class="num ${row.kind === "Dépense" ? "neg" : "pos"}">${row.kind === "Dépense" ? "−" : "+"}${money(row.montant)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.description)}</td></tr>`).join(""); // Date, pastille, montant signé, catégorie ou source, description.
  shell("Historique", `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Catégorie</th><th>Description</th></tr></thead><tbody>${rows || `<tr><td colspan="5">Aucune opération.</td></tr>`}</tbody></table></div>`); // Un seul tableau, ou le message vide.
} // Fin de l'historique.

async function renderStats() { // Dessine les statistiques du mois et le graphique de comparaison.
  let data; // Réponse ou copie.
  try { // Réseau.
    data = await api("/api/statistiques"); // Résumé du mois, catégories, et six mois.
    await saveMeta("statistiques", data); // Copie de toute la réponse.
  } catch { // Hors ligne.
    data = await readMeta("statistiques"); // Copie.
    if (!data) return offlineMessage(); // Rien en cache.
  } // Fin du chargement.
  const top = data.categories?.[0]; // Première catégorie : le serveur les trie de la plus chère à la moins chère. ?. évite une erreur si la liste manque.
  shell("Statistiques", ` <!-- titre -->
    <section class="cards"> <!-- quatre cartes -->
      <article class="card"><p>Revenus du mois</p><strong class="pos">${money(data.summary.revenus)}</strong></article> <!-- revenus en vert -->
      <article class="card"><p>Dépenses du mois</p><strong class="neg">${money(data.summary.depenses)}</strong></article> <!-- dépenses en rouge -->
      <article class="card"><p>Solde du mois</p><strong>${money(data.summary.solde)}</strong></article> <!-- revenus moins dépenses -->
      <article class="card"><p>Catégorie la plus coûteuse</p><strong>${top ? escapeHtml(top.nom) : "—"}</strong></article> <!-- nom, ou un tiret s'il n'y a aucune dépense ce mois -->
    </section> <!-- fin des cartes -->
    <div class="chart-card"><h2>Comparaison revenus et dépenses</h2><canvas id="compare-chart"></canvas></div>`); // Toile du graphique en barres.
  const canvas = document.getElementById("compare-chart"); // La toile vient d'être écrite.
  if (canvas && window.Chart) { // Toile présente et bibliothèque chargée.
    new Chart(canvas, { // Crée le graphique.
      type: "bar", // Barres.
      data: { // Données.
        labels: data.series.map((item) => item.label), // Noms des mois.
        datasets: [ // Deux séries côte à côte.
          { label: "Revenus", data: data.series.map((item) => item.revenus), backgroundColor: "#15803d", borderRadius: 6 }, // Barres vertes, coins arrondis.
          { label: "Dépenses", data: data.series.map((item) => item.depenses), backgroundColor: "#b91c1c", borderRadius: 6 }, // Barres rouges.
        ], // Fin des deux séries.
      }, // Fin des données.
      options: { responsive: true, maintainAspectRatio: false }, // Le graphique remplit la carte sans imposer ses proportions.
    }); // Fin de la création.
  } // Fin du dessin.
} // Fin des statistiques.

async function renderNotifications() { // Dessine la liste des messages. Les ouvrir les marque comme lus côté serveur.
  let data; // Réponse ou copie.
  try { // Réseau.
    data = await api("/api/notifications"); // Le serveur renvoie les messages puis les passe à « lu ».
    await saveMeta("notifications", data.notifications); // Copie de la liste.
  } catch { // Hors ligne.
    const cached = await readMeta("notifications"); // Copie.
    if (!cached) return offlineMessage(); // Rien en cache.
    data = { notifications: cached }; // Même forme.
  } // Fin du chargement.
  const items = data.notifications.map((item) => `<li><strong>${escapeHtml(item.titre)}</strong><p>${escapeHtml(item.message)}</p></li>`).join(""); // Un élément de liste par message : titre puis texte.
  shell("Notifications", `<ul class="notes">${items || "<li>Aucune notification.</li>"}</ul>`); // Liste, ou une phrase si elle est vide.
} // Fin des notifications.

async function renderProfil() { // Dessine les deux formulaires : identité, puis mot de passe.
  const data = await api("/api/profil").catch(() => null); // Lit le profil. En cas d'échec, catch remplace l'erreur par null.
  if (!data) return offlineMessage(); // Pas de copie locale pour cette page : hors ligne, on explique.
  shell("Profil", `<section class="split"> <!-- deux formulaires côte à côte -->
    <form id="form" class="panel"> <!-- identité -->
      <h2>Informations personnelles</h2> <!-- titre -->
      <label class="field">Nom<input name="nom" value="${escapeHtml(data.user.nom)}"></label> <!-- nom actuel déjà rempli -->
      <label class="field">Prénom<input name="prenom" value="${escapeHtml(data.user.prenom)}"></label> <!-- prénom actuel -->
      <label class="field">E-mail<input name="email" value="${escapeHtml(data.user.email)}"></label> <!-- e-mail actuel -->
      <button type="submit">Enregistrer</button> <!-- envoi de l'identité -->
    </form> <!-- fin du premier formulaire -->
    <form id="password" class="panel"> <!-- mot de passe -->
      <h2>Mot de passe</h2> <!-- titre -->
      <p class="errors" style="display:none"></p> <!-- erreurs de ce formulaire seulement -->
      <label class="field">Mot de passe actuel<input type="password" name="actuel" required></label> <!-- ancien mot de passe -->
      <label class="field">Nouveau mot de passe<input type="password" name="nouveau" required></label> <!-- nouveau -->
      <label class="field">Confirmation<input type="password" name="confirmation" required></label> <!-- deuxième saisie -->
      <button type="submit">Mettre à jour</button> <!-- envoi du mot de passe -->
    </form> <!-- fin du second formulaire -->
  </section>`); // Fin du HTML.
  document.querySelector("#password").onsubmit = async (event) => { // Envoi du mot de passe.
    event.preventDefault(); // Pas de rechargement.
    try { // On tente le changement.
      await api("/api/profil/mot-de-passe", { method: "POST", body: Object.fromEntries(new FormData(event.target)), mesure: "mot de passe" }); // Envoie actuel, nouveau et confirmation.
      event.target.reset(); // Vide les trois champs après le succès. La page ne montre pas de message de confirmation.
    } catch (error) { // Ancien mot de passe faux, nouveau trop court, ou confirmation différente.
      const box = event.target.querySelector(".errors"); // La zone d'erreurs de CE formulaire, pas celle d'un autre.
      box.style.display = "grid"; // On l'affiche.
      box.textContent = (error.data?.errors || ["Modification impossible."]).join(" "); // Messages, ou phrase de repli.
    } // Fin de l'erreur.
  }; // Fin de l'envoi du mot de passe.
  document.querySelector("#form").onsubmit = async (event) => { // Envoi du nom, du prénom et de l'e-mail.
    event.preventDefault(); // Pas de rechargement.
    const body = Object.fromEntries(new FormData(event.target)); // Les trois champs.
    const result = await api("/api/profil", { method: "POST", body, mesure: "profil" }); // Enregistre. Si le serveur refuse, l'erreur remonte : cette fonction n'a pas de catch, la page reste en place.
    user = result.user; // Met à jour le nom affiché dans le menu.
    renderProfil(); // Redessine la page avec les valeurs enregistrées.
  }; // Fin de l'envoi du profil.
} // Fin de la page profil.

function offlineMessage() { // Message quand une page n'a ni réseau ni copie locale.
  shell("Hors ligne", `<p>Ces données ne sont pas encore en cache. Ouvrez cette page une fois en ligne.</p>`); // Le cadre reste affiché si l'utilisateur est connecté en mémoire. Sinon shell montre l'écran public.
} // Fin du message hors ligne.

function money(value) { // Affiche un nombre comme une somme en dollars, à la française.
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(Number(value) || 0); // Exemple : 12.5 devient « 12,50 $US ». Une valeur vide devient 0.
} // Fin de l'affichage monétaire.

function escapeHtml(value) { // Rend un texte inoffensif avant de le mettre dans le HTML. Empêche un nom de compte d'être lu comme une balise.
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); // & d'abord, puis <, >, et le guillemet. L'ordre compte : sinon le & de &amp; serait repris.
} // Fin de la protection du texte.
