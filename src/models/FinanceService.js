import { Money } from "./Money.js"; // Pour transformer un nombre en texte du genre « 12,50 $US » dans les alertes.

// Regroupe les calculs d'argent : soldes, état des budgets, messages d'alerte.
export class FinanceService {
  constructor({ incomes, expenses, budgets, notifications }) { // Reçoit les quatre classes qui parlent aux tables.
    this.incomes = incomes; // Accès aux revenus.
    this.expenses = expenses; // Accès aux dépenses.
    this.budgets = budgets; // Accès aux budgets.
    this.notifications = notifications; // Accès aux messages.
  } // Fin du constructeur.

  summary(userId, range) { // Résumé d'une période : range.start et range.end sont les deux dates.
    const revenus = this.incomes.total(userId, range.start, range.end); // Somme des revenus sur la période.
    const depenses = this.expenses.total(userId, range.start, range.end); // Somme des dépenses sur la période.
    return { // On renvoie les trois nombres.
      revenus, // Total reçu.
      depenses, // Total dépensé.
      solde: Math.round((revenus - depenses) * 100) / 100, // Revenus moins dépenses, arrondi au centime.
    }; // Fin du résumé.
  } // Fin du résumé de période.

  lifetimeBalance(userId) { // Solde de tout l'historique, pas seulement du mois.
    return this.summary(userId, { start: "0001-01-01", end: "9999-12-31" }).solde; // On réutilise summary avec une période qui couvre toutes les dates possibles, puis on ne garde que le solde.
  } // Fin du solde global.

  budgetStatus(budget) { // Compare un budget à ce qui a déjà été dépensé.
    const spent = this.expenses.total( // Somme dépensée pendant la vie de ce budget.
      budget.id_utilisateur, // Compte du budget.
      budget.date_debut, // À partir du premier jour.
      budget.date_fin, // Jusqu'au dernier jour.
      budget.id_categorie, // Si vide, toutes les catégories ; sinon une seule.
    ); // Fin du calcul dépensé.
    const remaining = Math.round((budget.montant_limite - spent) * 100) / 100; // Ce qu'il reste. Peut être négatif si le plafond est dépassé. Arrondi au centime.
    let level = "ok"; // État de départ : dans la limite.
    if (spent > budget.montant_limite) level = "depasse"; // Dépensé plus que le plafond.
    else if (spent >= budget.montant_limite * 0.8) level = "proche"; // Dépensé au moins 80 % du plafond, sans le dépasser.
    return { spent, remaining, level }; // Montant dépensé, reste, et l'un des trois états : ok, proche, depasse.
  } // Fin de l'état d'un budget.

  notifyOperation(userId, titre, message) { // Enregistre un message simple, par exemple après un revenu.
    this.notifications.insert({ // Ajoute une ligne dans la table des notifications.
      userId, // Destinataire.
      titre, // Titre reçu en argument.
      message, // Texte reçu en argument.
      date: new Date().toISOString(), // Date et heure du moment, en texte standard.
    }); // Fin de l'ajout.
  } // Fin du message simple.

  notifyBudgets(userId, date, categoryId) { // Après une dépense, prévient si un budget concerné est presque plein ou dépassé.
    const active = this.budgets.activeFor(userId, date, categoryId); // Budgets qui couvrent le jour de la dépense.
    for (const budget of active) { // On regarde chaque budget trouvé, un par un.
      const status = this.budgetStatus(budget); // Calcule dépensé, reste et état.
      if (status.level === "ok") continue; // Encore loin du plafond : pas de message, on passe au suivant.
      const label = budget.id_categorie ? "de la catégorie" : "mensuel"; // Texte selon budget d'une catégorie ou budget global. Le mot « mensuel » est le libellé utilisé ici pour le budget sans catégorie.
      const titre = status.level === "depasse" ? "Budget dépassé" : "Budget presque épuisé"; // Titre selon l'état.
      this.notifications.insert({ // Enregistre l'alerte.
        userId, // Destinataire.
        titre, // « Budget dépassé » ou « Budget presque épuisé ».
        message: `${titre} ${label} : ${Money.format(status.spent)} dépensés sur ${Money.format(budget.montant_limite)}. Reste ${Money.format(status.remaining)}.`, // Phrase avec les montants déjà mis en forme.
        date: new Date().toISOString(), // Moment de l'alerte.
      }); // Fin de l'ajout du message.
    } // Fin de la boucle sur les budgets concernés.
  } // Fin des alertes de budget.
} // Fin de la classe FinanceService.
