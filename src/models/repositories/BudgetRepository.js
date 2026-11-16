// Cette classe lit et écrit la table des budgets.
export class BudgetRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour les fonctions suivantes.
  } // Fin du constructeur.

  list(userId) { // Liste tous les budgets d'un compte, avec le nom de catégorie s'il y en a un.
    return this.db.prepare( // Prépare la question.
      `SELECT b.*, c.nom_categorie -- Toutes les colonnes du budget, plus le nom de catégorie.
       FROM budgets b -- La table budgets est surnommée b.
       LEFT JOIN categories c ON c.id_categorie = b.id_categorie -- LEFT JOIN : un budget global, sans catégorie, reste dans la liste.
       WHERE b.id_utilisateur = ? -- Seulement ce compte.
       ORDER BY b.date_debut DESC, b.id_budget DESC`, // Le plus récent d'abord.
    ).all(userId); // Toutes les lignes de ce compte.
  } // Fin de la liste. Le serveur appelle cette fonction.

  find(id, userId) { // Retrouve un budget de ce compte. Le serveur actuel ne l'appelle pas.
    return this.db.prepare( // Prépare la recherche.
      `SELECT b.*, c.nom_categorie FROM budgets b
       LEFT JOIN categories c ON c.id_categorie = b.id_categorie -- Nom de catégorie facultatif.
       WHERE b.id_budget = ? AND b.id_utilisateur = ?`, // Numéro du budget ET propriétaire.
    ).get(id, userId) ?? null; // Une ligne, ou null.
  } // Fin de la recherche d'un budget.

  activeFor(userId, date, categoryId) { // Budgets de ce compte qui couvrent une date, et qui sont globaux ou de cette catégorie.
    return this.db.prepare( // Prépare la recherche.
      `SELECT * FROM budgets
       WHERE id_utilisateur = ? AND date_debut <= ? AND date_fin >= ? -- Le jour de la dépense est entre le début et la fin.
         AND (id_categorie IS NULL OR id_categorie = ?)`, // Budget global, ou budget de la même catégorie que la dépense.
    ).all(userId, date, date, categoryId); // La date sert deux fois : début et fin.
  } // Fin de la recherche des budgets concernés. Utilisé pour les alertes.

  insert(row) { // Ajoute un budget.
    const result = this.db.prepare( // Prépare l'ajout.
      `INSERT INTO budgets (id_utilisateur, id_categorie, montant_limite, periode, date_debut, date_fin)
       VALUES (?, ?, ?, ?, ?, ?)`, // Six valeurs.
    ).run(row.userId, row.categoryId, row.montant, row.periode, row.dateDebut, row.dateFin); // Exécute l'ajout.
    return Number(result.lastInsertRowid); // Numéro du nouveau budget.
  } // Fin de la création. Le serveur appelle cette fonction.

  delete(id, userId) { // Supprime un budget de ce compte. Le serveur actuel ne l'appelle pas.
    return this.db.prepare("DELETE FROM budgets WHERE id_budget = ? AND id_utilisateur = ?").run(id, userId).changes; // 1 si supprimé, 0 sinon.
  } // Fin de la suppression.
} // Fin de la classe BudgetRepository.
