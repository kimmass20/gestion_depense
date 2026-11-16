import { html, redirect, clean, readAmount, readDate, expenseFields, incomeFields, categoryOptions } from "./form.js"; // Réponses, nettoyage, lectures, et HTML des formulaires.

export class IncomePresenter { // Liste, crée, modifie et supprime les revenus du compte connecté.
  constructor({ incomes, categories, finance, notifications, view, layout }) { // Outils nécessaires.
    this.incomes = incomes; // Dépôt des revenus.
    this.categories = categories; // Catégories proposées dans le formulaire.
    this.finance = finance; // Pour écrire une notification après chaque action.
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // Vue de liste et de formulaire (partagée avec les dépenses).
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx, extra = {}) { // Affiche la liste et le formulaire. extra peut contenir des erreurs ou la ligne en cours de modification.
    const categories = this.categories.listForUser(ctx.user.id, "revenu"); // Catégories de revenu visibles par ce compte.
    const editing = extra.editing; // Ligne en cours de modification, ou rien.
    const values = extra.values || (editing ? { // Valeurs des champs : celles renvoyées après une erreur, sinon celles de la ligne, sinon vide.
      montant: editing.montant, // Montant de la ligne.
      source: editing.source, // Source du revenu.
      categorie: editing.id_categorie || "", // Catégorie, ou chaîne vide si elle n'en a pas.
      date: editing.date_revenu, // Date du revenu.
      description: editing.description || "", // Description, ou chaîne vide.
    } : {}); // Pas de modification : champs vides.
    const rows = this.incomes.list(ctx.user.id).map((row) => ({ // Transforme chaque revenu de la base en ligne de tableau.
      date: row.date_revenu, // Date affichée.
      montant: row.montant, // Montant.
      primary: row.source, // Colonne principale : la source.
      secondary: row.nom_categorie || "—", // Catégorie, ou un tiret s'il n'y en a pas.
      description: row.description, // Description.
      editHref: `/revenus/${row.id_revenu}`, // Adresse du formulaire de modification.
      deleteHref: `/revenus/${row.id_revenu}/supprimer`, // Adresse du bouton supprimer.
    })); // Fin des lignes.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Revenus", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: this.view.list({ // Tableau plus formulaire.
        title: "Revenus enregistrés", // Titre du tableau.
        rows, // Lignes.
        editing: editing ? { action: `/revenus/${editing.id_revenu}` } : null, // En modification, le formulaire poste vers l'adresse de cette ligne.
        form: { // Réglages du formulaire.
          action: "/revenus", // Adresse d'un nouveau revenu, et lien « Annuler ».
          errors: extra.errors, // Messages d'erreur.
          fields: incomeFields(categories, values), // Champs HTML.
          primaryLabel: "Source", // En-tête de la colonne source.
          secondaryLabel: "Catégorie", // En-tête de la colonne catégorie.
        }, // Fin du formulaire.
      }), // Fin du contenu.
    }), extra.errors ? 422 : 200); // 422 si la saisie a été refusée.
  } // Fin de show.

  create(ctx) { // Enregistre un nouveau revenu.
    const parsed = this.#parse(ctx); // Lit et vérifie le formulaire.
    if (parsed.errors.length) return this.show(ctx, parsed); // Erreurs : on réaffiche, parsed contient errors et values.
    this.incomes.insert({ userId: ctx.user.id, ...parsed.row }); // Écrit la ligne pour ce compte.
    this.finance.notifyOperation(ctx.user.id, "Revenu enregistré", `Revenu de ${parsed.row.source} enregistré.`); // Ajoute une notification.
    ctx.session.flash = "Revenu enregistré."; // Confirmation.
    return redirect("/revenus"); // Recharge la liste.
  } // Fin de create.

  editForm(ctx) { // Ouvre le formulaire déjà rempli pour un revenu existant.
    const editing = this.incomes.find(Number(ctx.params.id), ctx.user.id); // Cherche la ligne de ce compte seulement.
    if (!editing) return redirect("/revenus"); // Inconnue ou à quelqu'un d'autre : retour à la liste, sans détail.
    return this.show(ctx, { editing }); // Même page, avec le formulaire rempli.
  } // Fin de editForm.

  update(ctx) { // Enregistre la modification d'un revenu.
    const current = this.incomes.find(Number(ctx.params.id), ctx.user.id); // Vérifie que la ligne appartient à ce compte.
    if (!current) return redirect("/revenus"); // Sinon on n'écrit rien.
    const parsed = this.#parse(ctx); // Lit le formulaire.
    if (parsed.errors.length) return this.show(ctx, { ...parsed, editing: current }); // Erreurs : on garde le mode modification.
    this.incomes.update(current.id_revenu, ctx.user.id, parsed.row); // Écrit les nouvelles valeurs.
    this.finance.notifyOperation(ctx.user.id, "Revenu modifié", "Un revenu a été modifié."); // Notification.
    ctx.session.flash = "Revenu modifié."; // Confirmation.
    return redirect("/revenus"); // Retour à la liste.
  } // Fin de update.

  remove(ctx) { // Supprime un revenu de ce compte.
    const changes = this.incomes.delete(Number(ctx.params.id), ctx.user.id); // 1 si une ligne a disparu, 0 sinon.
    if (changes) this.finance.notifyOperation(ctx.user.id, "Revenu supprimé", "Un revenu a été supprimé."); // Notification seulement si la suppression a eu lieu.
    ctx.session.flash = changes ? "Revenu supprimé." : "Revenu introuvable."; // Message selon le résultat.
    return redirect("/revenus"); // Retour à la liste.
  } // Fin de remove.

  #parse(ctx) { // Lit le formulaire de revenu et renvoie erreurs, valeurs à réafficher, et ligne prête à enregistrer.
    const errors = []; // Messages, remplis au fur et à mesure.
    const montant = readAmount(ctx.body.montant, errors); // Montant positif.
    const source = clean(ctx.body.source); // Source nettoyée.
    const date = readDate(ctx.body.date, errors); // Date AAAA-MM-JJ.
    const description = clean(ctx.body.description); // Description nettoyée, peut être vide.
    let categoryId = clean(ctx.body.categorie) ? Number(ctx.body.categorie) : null; // Numéro de catégorie, ou null.
    if (!source) errors.push("La source du revenu est obligatoire."); // La source ne peut pas être vide.
    if (categoryId) { // Une catégorie a été choisie.
      const category = this.categories.findVisible(categoryId, ctx.user.id); // Elle doit être visible par ce compte.
      if (!category || category.type_categorie !== "revenu") { // Absente, ou ce n'est pas un revenu.
        errors.push("La catégorie choisie n'est pas un revenu."); // Message.
        categoryId = null; // On n'enregistrera pas ce numéro.
      } // Fin du refus.
    } // Fin du contrôle de catégorie.
    return { // Résultat pour create, update et show.
      errors, // Liste, vide si tout va bien.
      values: { montant: ctx.body.montant, source, categorie: ctx.body.categorie, date: ctx.body.date, description }, // Textes à remettre dans le formulaire. Le montant brut garde ce que la personne a tapé.
      row: { montant, source, description, date, categoryId }, // Valeurs prêtes pour la base.
    }; // Fin du résultat.
  } // Fin de #parse.
} // Fin de IncomePresenter.

export class ExpensePresenter { // Liste filtrée, crée, modifie et supprime les dépenses. Alerte les budgets.
  constructor({ expenses, categories, finance, notifications, view, layout }) { // Outils nécessaires.
    this.expenses = expenses; // Dépôt des dépenses.
    this.categories = categories; // Catégories de dépense.
    this.finance = finance; // Notifications d'opération et d'alerte de budget.
    this.notifications = notifications; // Compteur du menu.
    this.view = view; // Même vue de liste que les revenus.
    this.layout = layout; // Cadre avec le menu.
  } // Fin du constructeur.

  show(ctx, extra = {}) { // Affiche les filtres, le formulaire et le tableau.
    const categories = this.categories.listForUser(ctx.user.id, "depense"); // Catégories de dépense de ce compte.
    const periode = ["jour", "semaine", "mois", "annee"].includes(ctx.query.periode) ? ctx.query.periode : ""; // Période demandée dans l'adresse, ou aucune si la valeur est inconnue.
    const filters = { // Critères passés au dépôt.
      query: clean(ctx.query.q), // Texte cherché.
      categoryId: ctx.query.categorie ? Number(ctx.query.categorie) : null, // Numéro de catégorie, ou null pour toutes.
      periode, // Nom de période, peut être vide.
      ...this.#queryRange(periode), // Ajoute start et end si une période est choisie.
    }; // Fin des filtres.
    const editing = extra.editing; // Dépense en cours de modification, ou rien.
    const values = extra.values || (editing ? { // Champs : après une erreur, ou depuis la ligne, ou vides.
      montant: editing.montant, // Montant.
      categorie: editing.id_categorie, // Catégorie.
      date: editing.date_depense, // Date.
      moyen_paiement: editing.moyen_paiement, // Moyen de paiement.
      description: editing.description || "", // Description.
    } : {}); // Création : champs vides.
    const rows = this.expenses.list(ctx.user.id, filters).map((row) => ({ // Lignes déjà filtrées, mises en forme pour le tableau.
      date: row.date_depense, // Date.
      montant: row.montant, // Montant.
      primary: row.nom_categorie, // Colonne principale : la catégorie.
      secondary: row.moyen_paiement, // Colonne suivante : le paiement.
      description: row.description, // Description.
      editHref: `/depenses/${row.id_depense}`, // Lien modifier.
      deleteHref: `/depenses/${row.id_depense}/supprimer`, // Lien supprimer.
    })); // Fin des lignes.
    const search = /* formulaire des filtres, placé au-dessus du tableau */ `
      <form class="filters" method="get" action="/depenses"> <!-- Formulaire de filtres : method get met les choix dans l'adresse. -->
        ${fieldSearch(filters, categories)} <!-- Les trois listes et le champ de recherche. -->
      </form>`; // Fin du formulaire de filtres.
    return html(this.layout.renderPrivate({ // Page privée.
      title: "Dépenses", // Titre.
      user: ctx.user, // Compte du menu.
      unread: this.notifications.unreadCount(ctx.user.id), // Messages non lus.
      notice: ctx.notice, // Message flash.
      content: search + this.view.list({ // Filtres, puis formulaire et tableau.
        title: "Dépenses enregistrées", // Titre du tableau.
        rows, // Lignes filtrées.
        editing: editing ? { action: `/depenses/${editing.id_depense}` } : null, // En modification, le formulaire poste vers cette dépense.
        form: { // Réglages du formulaire d'écriture.
          action: "/depenses", // Adresse d'une nouvelle dépense.
          errors: extra.errors, // Messages d'erreur.
          fields: expenseFields(categories, values), // Champs HTML.
          primaryLabel: "Catégorie", // En-tête de colonne.
          secondaryLabel: "Paiement", // En-tête de colonne.
        }, // Fin du formulaire.
      }), // Fin de la liste.
    }), extra.errors ? 422 : 200); // 422 si la saisie a été refusée.
  } // Fin de show.

  create(ctx) { // Enregistre une dépense et prévient si un budget est touché.
    const parsed = this.#parse(ctx); // Lit le formulaire.
    if (parsed.errors.length) return this.show(ctx, parsed); // Erreurs : réaffichage.
    this.expenses.insert({ userId: ctx.user.id, ...parsed.row }); // Écrit la dépense.
    this.finance.notifyOperation(ctx.user.id, "Dépense enregistrée", "La dépense a été enregistrée."); // Notification simple.
    this.finance.notifyBudgets(ctx.user.id, parsed.row.date, parsed.row.categoryId); // Alerte si un budget qui couvre cette date est proche ou dépassé.
    ctx.session.flash = "Dépense enregistrée."; // Confirmation.
    return redirect("/depenses"); // Recharge la liste.
  } // Fin de create.

  editForm(ctx) { // Ouvre le formulaire rempli pour une dépense existante.
    const editing = this.expenses.find(Number(ctx.params.id), ctx.user.id); // Ligne de ce compte seulement.
    if (!editing) return redirect("/depenses"); // Inconnue : retour à la liste.
    return this.show(ctx, { editing }); // Même page, formulaire rempli.
  } // Fin de editForm.

  update(ctx) { // Enregistre la modification et revérifie les budgets.
    const current = this.expenses.find(Number(ctx.params.id), ctx.user.id); // La dépense doit appartenir à ce compte.
    if (!current) return redirect("/depenses"); // Sinon on n'écrit rien.
    const parsed = this.#parse(ctx); // Lit le formulaire.
    if (parsed.errors.length) return this.show(ctx, { ...parsed, editing: current }); // Erreurs : on reste en modification.
    this.expenses.update(current.id_depense, ctx.user.id, parsed.row); // Écrit les nouvelles valeurs.
    this.finance.notifyOperation(ctx.user.id, "Dépense modifiée", "Une dépense a été modifiée."); // Notification.
    this.finance.notifyBudgets(ctx.user.id, parsed.row.date, parsed.row.categoryId); // Revérifie les budgets sur la nouvelle date et catégorie.
    ctx.session.flash = "Dépense modifiée."; // Confirmation.
    return redirect("/depenses"); // Retour à la liste.
  } // Fin de update.

  remove(ctx) { // Supprime une dépense de ce compte.
    const changes = this.expenses.delete(Number(ctx.params.id), ctx.user.id); // 1 ou 0.
    if (changes) this.finance.notifyOperation(ctx.user.id, "Dépense supprimée", "Une dépense a été supprimée."); // Notification seulement en cas de succès.
    ctx.session.flash = changes ? "Dépense supprimée." : "Dépense introuvable."; // Message selon le résultat.
    return redirect("/depenses"); // Retour à la liste.
  } // Fin de remove.

  #queryRange(periode) { // Transforme un nom de période en dates de début et de fin. Objet vide si pas de filtre.
    if (!periode) return {}; // Pas de période : le dépôt ne filtre pas les dates.
    if (!["jour", "semaine", "mois", "annee"].includes(periode)) return {}; // Valeur inconnue : même chose.
    return Period.range(periode); // start, end et label.
  } // Fin de #queryRange.

  #parse(ctx) { // Lit le formulaire de dépense.
    const errors = []; // Messages.
    const montant = readAmount(ctx.body.montant, errors); // Montant positif.
    const date = readDate(ctx.body.date, errors); // Date réelle.
    const moyenPaiement = clean(ctx.body.moyen_paiement); // Moyen de paiement nettoyé.
    const description = clean(ctx.body.description); // Description, peut être vide.
    const categoryId = Number(ctx.body.categorie); // Numéro de catégorie. Number("") vaut 0, qui ne correspondra à aucune catégorie.
    const category = this.categories.findVisible(categoryId, ctx.user.id); // Catégorie visible, ou rien.
    if (!category || category.type_categorie !== "depense") errors.push("Chaque dépense doit être associée à une catégorie de dépense."); // Catégorie obligatoire et du bon type.
    if (!moyenPaiement) errors.push("Le moyen de paiement est obligatoire."); // Le champ ne peut pas être vide.
    return { // Résultat pour create, update et show.
      errors, // Liste.
      values: ctx.body, // On réaffiche exactement les champs envoyés.
      row: { montant, date, moyenPaiement, description, categoryId }, // Valeurs pour la base.
    }; // Fin du résultat.
  } // Fin de #parse.
} // Fin de ExpensePresenter.

function fieldSearch(filters, categories) { // HTML des filtres de la page dépenses.
  const cats = categoryOptions(categories); // Choix de catégories : valeur + nom.
  return /* HTML des trois filtres et du bouton */ `
    <label class="field"><span>Recherche</span><input name="q" value="${escape(filters.query)}"></label> <!-- Champ texte. Le name q devient ?q= dans l'adresse. -->
    <label class="field"><span>Catégorie</span><select name="categorie"><option value="">Toutes</option>${cats.map((item) => `<option value="${item.value}" ${String(item.value) === String(filters.categoryId || "") ? "selected" : ""}>${escape(item.label)}</option>`).join("")}</select></label> <!-- Liste des catégories. L'option choisie reçoit selected. « Toutes » a une valeur vide. -->
    <label class="field"><span>Période</span><select name="periode"> <!-- Liste jour, semaine, mois, année. -->
      <option value="">Toutes</option> <!-- Valeur vide : pas de filtre de date. -->
      ${[["jour", "Journée"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]].map(([value, label]) => `<option value="${value}"${filters.periode === value ? " selected" : ""}>${label}</option>`).join("")} <!-- Une option par période. selected si c'est celle déjà demandée. -->
    </select></label> <!-- Fin de la liste période. -->
    <button type="submit">Filtrer</button>`; // Bouton qui recharge la page avec les filtres.
} // Fin de fieldSearch.

function escape(value) { // Rend un texte sûr dans le HTML des filtres.
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); // Remplace les caractères qui ouvriraient une balise ou un attribut.
} // Fin de escape.
