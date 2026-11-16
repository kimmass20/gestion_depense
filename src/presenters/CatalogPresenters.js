import { Period } from "../models/Period.js"; // Calcule le premier et le dernier jour du mois en cours.
import { html, redirect, clean, readAmount, readDate } from "./form.js"; // Outils de réponse, de nettoyage, de montant et de date.

export class CategoryPresenter { // Créer, renommer et supprimer des catégories.
  constructor({ categories, notifications, view, layout }) { // Outils nécessaires.
    this.categories = categories; // Dépôt des catégories.
    this.notifications = notifications; // Pour le compteur de messages non lus.
    this.view = view; // HTML de la page catégories.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx, extra = {}) { // Affiche la liste et le formulaire. extra porte les erreurs et les valeurs retapées.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Catégories", // Titre.
      user: ctx.user, // Compte connecté, pour le menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Notifications non lues.
      notice: ctx.notice, // Message flash.
      content: this.view.render({ // Contenu de la page.
        categories: this.categories.listForUser(ctx.user.id), // Catégories prédéfinies plus celles de ce compte.
        errors: extra.errors, // Messages du formulaire, s'il y en a.
        values: extra.values || {}, // Valeurs à remettre dans les champs, ou objet vide.
      }), // Fin du contenu.
    }), extra.errors ? 422 : 200); // Code 422 s'il y a des erreurs, sinon 200.
  } // Fin de show.

  create(ctx) { // Enregistre une nouvelle catégorie personnelle.
    const nom = clean(ctx.body.nom); // Nom nettoyé.
    const type = ctx.body.type === "revenu" ? "revenu" : "depense"; // Seulement deux types. Tout le reste devient « depense ».
    const errors = []; // Messages d'erreur.
    if (nom.length < 2) errors.push("Le nom de la catégorie est trop court."); // Au moins deux caractères.
    const duplicate = this.categories.listForUser(ctx.user.id, type) // Catégories du même type déjà visibles.
      .some((item) => item.nom_categorie.toLowerCase() === nom.toLowerCase()); // Vrai si le même nom existe déjà, sans tenir compte des majuscules.
    if (duplicate) errors.push("Cette catégorie existe déjà."); // On refuse le doublon.
    if (errors.length) return this.show(ctx, { errors, values: { nom, type } }); // Réaffiche le formulaire avec ce qui a été tapé.
    this.categories.insert({ userId: ctx.user.id, nom, type }); // Enregistre la catégorie pour ce compte.
    ctx.session.flash = "Catégorie créée."; // Confirmation pour la page suivante.
    return redirect("/categories"); // Recharge la liste.
  } // Fin de create.

  rename(ctx) { // Change le nom d'une catégorie personnelle.
    const nom = clean(ctx.body.nom); // Nouveau nom nettoyé.
    if (nom.length < 2) { // Nom trop court : on ne cherche même pas la catégorie.
      ctx.session.flash = "Le nom est trop court."; // Message d'échec.
      return redirect("/categories"); // Retour à la liste.
    } // Fin du contrôle de longueur.
    const changes = this.categories.update(Number(ctx.params.id), ctx.user.id, nom); // Met à jour seulement si la catégorie appartient à ce compte. changes vaut 1 ou 0.
    ctx.session.flash = changes ? "Catégorie renommée." : "Seules vos catégories personnelles peuvent être modifiées."; // Message selon le résultat.
    return redirect("/categories"); // Retour à la liste.
  } // Fin de rename.

  remove(ctx) { // Supprime une catégorie personnelle qui n'est plus utilisée.
    const id = Number(ctx.params.id); // Numéro lu dans l'adresse.
    const category = this.categories.findVisible(id, ctx.user.id); // Catégorie visible par ce compte, ou rien.
    if (!category || category.id_utilisateur !== ctx.user.id) { // Absente, ou catégorie prédéfinie (pas de propriétaire).
      ctx.session.flash = "Cette catégorie ne peut pas être supprimée."; // On refuse.
      return redirect("/categories"); // Retour à la liste.
    } // Fin du refus.
    if (this.categories.usageCount(id) > 0) { // Des revenus ou des dépenses pointent encore vers elle.
      ctx.session.flash = "Cette catégorie est utilisée. Réaffectez ses opérations avant de la supprimer."; // On explique pourquoi.
      return redirect("/categories"); // On ne supprime pas.
    } // Fin du contrôle d'usage.
    this.categories.delete(id, ctx.user.id); // Suppression réelle, limitée au propriétaire.
    ctx.session.flash = "Catégorie supprimée."; // Confirmation.
    return redirect("/categories"); // Retour à la liste.
  } // Fin de remove.
} // Fin de CategoryPresenter.

export class BudgetPresenter { // Créer et supprimer des budgets, et montrer ce qui reste.
  constructor({ budgets, categories, finance, notifications, view, layout }) { // Outils nécessaires.
    this.budgets = budgets; // Dépôt des budgets.
    this.categories = categories; // Pour la liste des catégories de dépense.
    this.finance = finance; // Calcule dépensé, reste et niveau (ok, proche, dépassé).
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // HTML de la page budgets.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx, extra = {}) { // Affiche les budgets et le formulaire.
    const rows = this.budgets.list(ctx.user.id).map((item) => { // Une ligne d'affichage par budget du compte.
      const status = this.finance.budgetStatus(item); // spent, remaining, level.
      return { // Objet simple pour la vue.
        id_budget: item.id_budget, // Numéro, utile pour le bouton supprimer.
        nom: item.nom_categorie || "Budget global", // Nom de la catégorie, ou « Budget global » s'il n'y en a pas.
        limit: item.montant_limite, // Plafond.
        date_debut: item.date_debut, // Début de la période.
        date_fin: item.date_fin, // Fin de la période.
        ...status, // Ajoute spent, remaining et level.
      }; // Fin de la ligne.
    }); // Fin de la liste.
    const categories = this.categories.listForUser(ctx.user.id, "depense") // Seulement les catégories de dépense.
      .map((item) => ({ value: item.id_categorie, label: item.nom_categorie })); // Choix de la liste déroulante.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Budgets", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: this.view.render({ // Contenu.
        budgets: rows, // Lignes calculées.
        categories, // Choix du formulaire.
        formErrors: extra.errors, // Erreurs de saisie.
        values: extra.values || defaultMonth(), // Valeurs du formulaire, ou le mois en cours par défaut.
      }), // Fin du contenu.
    }), extra.errors ? 422 : 200); // 422 si le formulaire a été refusé.
  } // Fin de show.

  create(ctx) { // Enregistre un nouveau budget.
    const errors = []; // Messages d'erreur, remplis par les lectures ci-dessous.
    const montant = readAmount(ctx.body.montant, errors); // Plafond, nombre positif.
    const dateDebut = readDate(ctx.body.date_debut, errors, "La date de début"); // Début, date réelle.
    const dateFin = readDate(ctx.body.date_fin, errors, "La date de fin"); // Fin, date réelle.
    if (dateDebut && dateFin && dateFin < dateDebut) errors.push("La date de fin doit suivre la date de début."); // L'ordre des dates. La comparaison texte marche car le format est AAAA-MM-JJ.
    let categoryId = clean(ctx.body.categorie) ? Number(ctx.body.categorie) : null; // Numéro de catégorie, ou null pour un budget global.
    if (categoryId) { // Une catégorie a été choisie : on vérifie qu'elle est légitime.
      const category = this.categories.findVisible(categoryId, ctx.user.id); // Catégorie visible par ce compte.
      if (!category || category.type_categorie !== "depense") { // Absente, ou ce n'est pas une catégorie de dépense.
        errors.push("Le budget de catégorie doit porter sur une catégorie de dépense."); // Message.
        categoryId = null; // On n'enregistrera pas ce numéro.
      } // Fin du refus de catégorie.
    } // Fin du contrôle de catégorie.
    if (errors.length) return this.show(ctx, { errors, values: ctx.body }); // Réaffiche le formulaire avec les champs envoyés.
    this.budgets.insert({ // Enregistre le budget.
      userId: ctx.user.id, // Propriétaire.
      categoryId, // Catégorie ou null.
      montant, // Plafond.
      periode: "mensuel", // Libellé de période enregistré avec le budget.
      dateDebut, // Début.
      dateFin, // Fin.
    }); // Fin de l'enregistrement.
    ctx.session.flash = "Budget enregistré."; // Confirmation.
    return redirect("/budgets"); // Recharge la liste.
  } // Fin de create.

  remove(ctx) { // Supprime un budget de ce compte.
    const changes = this.budgets.delete(Number(ctx.params.id), ctx.user.id); // 1 si une ligne a été effacée, 0 sinon.
    ctx.session.flash = changes ? "Budget supprimé." : "Budget introuvable."; // Message selon le résultat.
    return redirect("/budgets"); // Retour à la liste.
  } // Fin de remove.
} // Fin de BudgetPresenter.

function defaultMonth() { // Valeurs de départ du formulaire : du premier au dernier jour du mois, montant vide.
  const range = Period.range("mois"); // start, end et label du mois en cours.
  return { date_debut: range.start, date_fin: range.end, montant: "" }; // Champs préremplis.
} // Fin de defaultMonth.
