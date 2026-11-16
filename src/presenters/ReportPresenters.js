import { Period } from "../models/Period.js"; // Dates de période et fenêtre des six derniers mois.
import { html } from "./form.js"; // Réponse HTML. Ces pages ne redirigent pas : elles affichent seulement.

export class DashboardPresenter { // Tableau de bord : totaux, dernières opérations, graphiques, budgets en cours.
  constructor({ finance, expenses, incomes, budgets, notifications, view, layout }) { // Outils nécessaires.
    this.finance = finance; // Soldes et état des budgets.
    this.expenses = expenses; // Dépenses, totaux et regroupement par catégorie.
    this.incomes = incomes; // Revenus récents.
    this.budgets = budgets; // Budgets du compte.
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // HTML du tableau de bord.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx) { // Construit les chiffres de la période demandée et affiche la page.
    const rangeName = ["jour", "semaine", "mois", "annee"].includes(ctx.query.periode) ? ctx.query.periode : "mois"; // Période dans l'adresse, sinon le mois.
    const range = Period.range(rangeName); // Début, fin et libellé de cette période.
    const summary = this.finance.summary(ctx.user.id, range); // Revenus, dépenses et solde sur la période.
    const incomeRows = this.incomes.list(ctx.user.id, range).slice(0, 5).map((row) => ({ // Au plus cinq revenus de la période.
      date: row.date_revenu, // Date.
      kind: "Revenu", // Type affiché dans le tableau.
      label: row.source, // Texte : la source.
      montant: row.montant, // Montant.
    })); // Fin des revenus.
    const expenseRows = this.expenses.list(ctx.user.id, range).slice(0, 5).map((row) => ({ // Au plus cinq dépenses de la période.
      date: row.date_depense, // Date.
      kind: "Dépense", // Type affiché.
      label: row.nom_categorie, // Texte : la catégorie.
      montant: row.montant, // Montant.
    })); // Fin des dépenses.
    const recent = [...incomeRows, ...expenseRows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8); // Mélange les deux listes, les trie de la plus récente à la plus ancienne, garde huit lignes.
    const categories = this.expenses.byCategory(ctx.user.id, range.start, range.end).slice(0, 5); // Cinq catégories les plus dépensières sur la période.
    const series = Period.monthWindow(6).map((month) => ({ // Un point par mois, sur six mois.
      label: month.label, // Nom court du mois, pour l'axe du graphique.
      total: this.expenses.total(ctx.user.id, month.start, month.end), // Total dépensé ce mois-là.
    })); // Fin de la série.
    const today = new Date().toISOString().slice(0, 10); // Date du jour, AAAA-MM-JJ.
    const budgetCards = this.budgets.list(ctx.user.id) // Tous les budgets du compte.
      .filter((item) => item.date_debut <= today && item.date_fin >= today) // Seulement ceux qui couvrent aujourd'hui.
      .map((item) => { // On ajoute l'état calculé.
        const status = this.finance.budgetStatus(item); // spent, remaining, level.
        return { // Carte prête pour la vue.
          nom: item.nom_categorie || "Budget global", // Nom, ou « Budget global ».
          global: !item.id_categorie, // Vrai s'il n'est pas lié à une catégorie.
          limit: item.montant_limite, // Plafond.
          ...status, // Ajoute spent, remaining, level.
        }; // Fin de la carte.
      }); // Fin des cartes.
    const globalBudget = budgetCards.find((item) => item.global); // Le budget global en cours, s'il y en a un.
    const budgetDisponible = globalBudget // Reste à dépenser affiché sur la grande carte.
      ? globalBudget.remaining // S'il y a un budget global, on montre son reste.
      : budgetCards.reduce((sum, item) => sum + item.remaining, 0); // Sinon on additionne les restes des budgets de catégorie.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Tableau de bord", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: this.view.render({ // Tous les chiffres pour le HTML.
        rangeName, // Pour surligner le bouton de période actif.
        rangeLabel: range.label, // Texte du type « mars 2026 » dans les cartes.
        summary, // Revenus, dépenses, solde de la période.
        soldeActuel: this.finance.lifetimeBalance(ctx.user.id), // Solde depuis le début, pas seulement la période.
        budgetDisponible: budgetCards.length ? budgetDisponible : null, // null s'il n'y a aucun budget en cours : la vue affichera « Aucun budget ».
        recent, // Huit dernières opérations.
        categories, // Cinq catégories pour le camembert.
        series, // Six mois pour la courbe.
        budgets: budgetCards, // Cartes de budget.
      }), // Fin du contenu.
    })); // Fin de la page.
  } // Fin de show.
} // Fin de DashboardPresenter.

export class StatsPresenter { // Statistiques du mois en cours et comparaison sur six mois.
  constructor({ finance, expenses, notifications, view, layout }) { // Outils nécessaires.
    this.finance = finance; // Totaux revenus / dépenses / solde.
    this.expenses = expenses; // Dépenses regroupées par catégorie.
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // HTML des statistiques.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx) { // Calcule les chiffres du mois et des six derniers mois.
    const range = Period.range("mois"); // Du premier au dernier jour du mois en cours.
    const summary = this.finance.summary(ctx.user.id, range); // Totaux du mois.
    const categories = this.expenses.byCategory(ctx.user.id, range.start, range.end); // Dépenses du mois par catégorie, déjà triées.
    const series = Period.monthWindow(6).map((month) => ({ // Une barre par mois.
      label: month.label, // Nom du mois.
      revenus: this.finance.summary(ctx.user.id, month).revenus, // Total des revenus de ce mois.
      depenses: this.finance.summary(ctx.user.id, month).depenses, // Total des dépenses de ce mois.
    })); // Fin de la série.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Statistiques", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: this.view.render({ // Chiffres pour la page.
        summary, // Cartes du mois.
        categories, // Tableau par catégorie. La première est la plus coûteuse.
        series, // Données du graphique en barres.
        comparison: summary.solde, // Solde du mois, transmis à la vue.
      }), // Fin du contenu.
    })); // Fin de la page.
  } // Fin de show.
} // Fin de StatsPresenter.

export class HistoryPresenter { // Historique mélangé des revenus et des dépenses, avec filtres.
  constructor({ incomes, expenses, categories, notifications, view, layout }) { // Outils nécessaires.
    this.incomes = incomes; // Dépôt des revenus.
    this.expenses = expenses; // Dépôt des dépenses.
    this.categories = categories; // Liste du filtre catégorie.
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // HTML de l'historique.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx) { // Lit les filtres dans l'adresse, charge les lignes, affiche la page.
    const type = ["revenu", "depense", "toutes"].includes(ctx.query.type) ? ctx.query.type : "toutes"; // Type demandé, sinon les deux.
    const periode = ["jour", "semaine", "mois", "annee", "tout"].includes(ctx.query.periode) ? ctx.query.periode : "mois"; // Période demandée, sinon le mois.
    const categorie = ctx.query.categorie || ""; // Numéro de catégorie, ou chaîne vide pour toutes.
    const range = periode === "tout" ? { start: "0001-01-01", end: "9999-12-31" } : Period.range(periode); // « tout » couvre toutes les dates possibles. Sinon la période calculée.
    const filter = { ...range, categoryId: categorie || null }; // Début, fin, et catégorie ou null.
    const rows = []; // Lignes mélangées, remplies juste après.
    if (type !== "depense") { // On inclut les revenus sauf si le filtre dit « dépenses seulement ».
      rows.push(...this.incomes.list(ctx.user.id, filter).map((row) => ({ // Ajoute chaque revenu.
        date: row.date_revenu, // Date.
        kind: "Revenu", // Type affiché.
        montant: row.montant, // Montant.
        category: row.nom_categorie || row.source, // Catégorie, ou la source s'il n'y a pas de catégorie.
        description: row.description, // Description.
      }))); // Fin des revenus.
    } // Fin du bloc revenus.
    if (type !== "revenu") { // On inclut les dépenses sauf si le filtre dit « revenus seulement ».
      rows.push(...this.expenses.list(ctx.user.id, filter).map((row) => ({ // Ajoute chaque dépense.
        date: row.date_depense, // Date.
        kind: "Dépense", // Type affiché.
        montant: row.montant, // Montant.
        category: row.nom_categorie, // Catégorie.
        description: row.description, // Description.
      }))); // Fin des dépenses.
    } // Fin du bloc dépenses.
    rows.sort((a, b) => b.date.localeCompare(a.date)); // Plus récent en haut. Le format AAAA-MM-JJ se trie comme du texte.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Historique", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: this.view.render({ // Contenu.
        rows, // Lignes triées.
        filters: { type, periode, categorie }, // Pour réafficher les listes sur le bon choix.
        categories: this.categories.listForUser(ctx.user.id).map((item) => ({ // Toutes les catégories visibles, revenus et dépenses.
          value: item.id_categorie, // Numéro envoyé dans l'adresse.
          label: `${item.nom_categorie} (${item.type_categorie})`, // Nom plus le type, pour les distinguer.
        })), // Fin des choix.
      }), // Fin du contenu.
    })); // Fin de la page.
  } // Fin de show.
} // Fin de HistoryPresenter.

export class NotificationPresenter { // Liste des alertes. Les ouvrir les marque comme lues.
  constructor({ notifications, view, layout }) { // Outils nécessaires.
    this.notifications = notifications; // Dépôt des notifications.
    this.view = view; // HTML de la liste.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx) { // Affiche les messages de ce compte, puis les marque lus.
    const items = this.notifications.list(ctx.user.id); // Messages, les non lus d'abord.
    this.notifications.markAllRead(ctx.user.id); // Après la lecture de la liste, plus aucun n'est « non lu ».
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Notifications", // Titre.
      user: ctx.user, // Compte du menu.
      unread: 0, // Le compteur retombe à zéro, puisque tout vient d'être marqué lu.
      notice: ctx.notice, // Message flash.
      content: this.view.render(items), // Liste HTML. items a encore l'ancien statut, donc les non lus restent visuellement marqués sur cette page.
    })); // Fin de la page.
  } // Fin de show.
} // Fin de NotificationPresenter.
