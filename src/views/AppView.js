import { escapeHtml, flash, page } from "./html.js"; // escapeHtml protège le texte. flash est le bandeau. page est le document complet.

const NAV = [ // Liens du menu principal. Chaque ligne : adresse, nom d'icône, texte.
  ["/", "grid_view", "Tableau de bord"], // Accueil privé.
  ["/revenus", "trending_up", "Revenus"], // Page des revenus.
  ["/depenses", "trending_down", "Dépenses"], // Page des dépenses.
  ["/categories", "category", "Catégories"], // Page des catégories.
  ["/budgets", "pie_chart", "Budgets"], // Page des budgets.
  ["/historique", "receipt_long", "Historique"], // Historique.
  ["/statistiques", "monitoring", "Statistiques"], // Statistiques.
]; // Fin du menu principal.

const ACCOUNT = [ // Liens du bloc « Compte », sous le menu principal.
  ["/notifications", "notifications", "Notifications"], // Liste des alertes.
  ["/profil", "person", "Profil"], // Nom, e-mail, mot de passe.
]; // Fin du bloc compte.

function icon(name) { // Une icône Material Symbols. name est le nom de l'icône, pas un texte libre de l'utilisateur.
  return `<span class="material-symbols-outlined">${name}</span>`; // La police d'icônes dessine le symbole à partir de ce nom.
} // Fin de icon.

export class AppView { // Cadre commun : page publique simple, ou page privée avec menu.
  renderPublic(title, content, notice) { // Page sans menu : accueil, inscription, connexion.
    return page(title, /* page publique, sans le menu */ `
      <div class="gate"> <!-- Colonne centrée. -->
        <a class="gate-brand" href="/">${icon("account_balance_wallet")} Dépenses</a> <!-- Logo qui ramène à l'accueil. -->
        ${flash(notice)} <!-- Bandeau de message, ou rien. -->
        <section class="gate-card">${content}</section> <!-- Carte blanche qui contient le formulaire ou le texte d'accueil. -->
      </div>`); // Fin de la colonne.
  } // Fin de renderPublic.

  renderPrivate({ title, user, unread, notice, content }) { // Page connectée. unread est le nombre de notifications non lues.
    const initial = escapeHtml(`${user.prenom?.[0] || ""}${user.nom?.[0] || ""}`.toUpperCase()); // Initiales : première lettre du prénom et du nom, en majuscules. Vide si le champ manque.
    const link = ([href, glyph, label]) => { // Fabrique un lien de menu à partir d'une ligne [adresse, icône, texte].
      const badge = href === "/notifications" && unread // Pastille de nombre, seulement sur Notifications et seulement s'il y a des non lus.
        ? `<span class="badge">${unread}</span>` // Le nombre.
        : ""; // Sinon rien.
      return `<a href="${href}" data-nav="${href}">${icon(glyph)}<span>${label}</span>${badge}</a>`; // Lien. data-nav sert au script qui surligne la page en cours.
    }; // Fin de link.
    return page(title, /* page connectée, avec le menu à gauche */ `
      <div class="shell"> <!-- Page en deux parties : menu à gauche, travail à droite. -->
        <aside> <!-- Menu latéral. -->
          <a class="brand" href="/">${icon("account_balance_wallet")}<span><strong>Dépenses</strong><small>Finances personnelles</small></span></a> <!-- Nom de l'application. -->
          <p class="nav-label">Navigation</p> <!-- Petit titre au-dessus du menu principal. -->
          <nav>${NAV.map(link).join("")}</nav> <!-- Liens du menu principal, collés. -->
          <p class="nav-label">Compte</p> <!-- Petit titre au-dessus des liens du compte. -->
          <nav>${ACCOUNT.map(link).join("")}</nav> <!-- Notifications et profil. -->
          <form method="post" action="/deconnexion"><button type="submit">${icon("logout")}<span>Déconnexion</span></button></form> <!-- Bouton qui envoie une requête POST pour effacer la session. -->
          <div class="account"> <!-- Bloc en bas du menu : qui est connecté. -->
            <span class="avatar">${initial}</span> <!-- Rond avec les initiales. -->
            <p><strong>${escapeHtml(user.prenom)} ${escapeHtml(user.nom)}</strong><small>${escapeHtml(user.email)}</small></p> <!-- Nom complet et e-mail, textes protégés. -->
          </div> <!-- Fin du bloc compte. -->
        </aside> <!-- Fin du menu. -->
        <div class="workspace"> <!-- Zone de droite. -->
          <header class="topbar"> <!-- Barre du haut. -->
            <p>Finances personnelles <span>/</span> ${escapeHtml(title)}</p> <!-- Fil d'Ariane : le titre de la page. -->
            <form class="top-search" method="get" action="/depenses"> <!-- Recherche rapide, envoyée vers la page dépenses. -->
              ${icon("search")} <!-- Icône loupe. -->
              <input name="q" placeholder="Rechercher une dépense" aria-label="Rechercher une dépense"> <!-- Champ. name q est lu par la page dépenses. aria-label décrit le champ pour un lecteur d'écran. -->
            </form> <!-- Fin de la recherche. -->
            <a class="bell" href="/notifications" aria-label="Notifications">${icon("notifications")}${unread ? `<i>${unread}</i>` : ""}</a> <!-- Cloche. Le nombre n'apparaît que s'il y a des non lus. -->
          </header> <!-- Fin de la barre. -->
          <main> <!-- Contenu de la page. -->
            ${flash(notice)} <!-- Bandeau de confirmation, ou rien. -->
            ${content} <!-- HTML propre à cette page, préparé par la vue. -->
          </main> <!-- Fin du contenu. -->
        </div> <!-- Fin de la zone de droite. -->
      </div> <!-- Fin de la page en deux parties. -->
      <script> // Surligne dans le menu le lien de la page affichée.
        const path = location.pathname === "/tableau-de-bord" ? "/" : location.pathname; // L'adresse du tableau de bord compte comme l'accueil pour le surlignage.
        document.querySelectorAll("[data-nav]").forEach((link) => { // Pour chaque lien du menu.
          const href = link.getAttribute("data-nav"); // Adresse prévue pour ce lien.
          const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/"); // Actif si l'adresse est exactement celle du lien, ou une sous-page. L'accueil ne doit pas tout surligner.
          if (active) link.classList.add("active"); // Ajoute la classe qui met le lien en évidence.
        }); // Fin de la boucle sur les liens.
      </script>`); // Fin du petit script. Les // ci-dessus sont des commentaires du JavaScript envoyé au navigateur : ils ne changent pas ce qu'il fait.
  } // Fin de renderPrivate.
} // Fin de AppView.
