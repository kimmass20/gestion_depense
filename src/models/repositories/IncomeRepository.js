// Début de la question commune : un revenu, plus le nom de sa catégorie s'il y en a une.
// LEFT JOIN garde le revenu même si la catégorie est vide.
const SELECT = `
  SELECT r.*, c.nom_categorie -- r.* = toutes les colonnes du revenu. c.nom_categorie = le nom de la catégorie.
  FROM revenus r -- La table revenus est surnommée r.
  LEFT JOIN categories c ON c.id_categorie = r.id_categorie -- On rattache la catégorie qui a le même numéro, sans perdre le revenu si elle manque.
`; // Fin du morceau SQL réutilisé.

// Cette classe lit et écrit la table des revenus.
export class IncomeRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour les fonctions suivantes.
  } // Fin du constructeur.

  list(userId, { start, end, categoryId } = {}) { // Liste les revenus d'un compte. Les filtres de dates et de catégorie sont facultatifs.
    return this.db.prepare( // Prépare la question complète.
      `${SELECT}
       WHERE r.id_utilisateur = ? -- Seulement les revenus de ce compte.
         AND (? IS NULL OR r.date_revenu >= ?) -- Si aucune date de début, on ne filtre pas. Sinon, date supérieure ou égale.
         AND (? IS NULL OR r.date_revenu <= ?) -- Même idée pour la date de fin.
         AND (? IS NULL OR r.id_categorie = ?) -- Même idée pour la catégorie.
       ORDER BY r.date_revenu DESC, r.id_revenu DESC`, // Plus récent d'abord. DESC veut dire ordre décroissant.
    ).all(userId, start ?? null, start ?? null, end ?? null, end ?? null, categoryId ?? null, categoryId ?? null); // Chaque filtre est passé deux fois : une fois pour le test « est-il vide ? », une fois pour la comparaison.
  } // Fin de la liste. Le serveur appelle cette fonction.

  find(id, userId) { // Retrouve un seul revenu de ce compte. Le serveur actuel ne l'appelle pas.
    return this.db.prepare(`${SELECT} WHERE r.id_revenu = ? AND r.id_utilisateur = ?`).get(id, userId) ?? null; // Le numéro du revenu ne suffit pas : il doit aussi appartenir à ce compte.
  } // Fin de la recherche d'un revenu.

  insert(row) { // Ajoute un revenu. row contient les champs déjà vérifiés par le serveur.
    const result = this.db.prepare( // Prépare l'ajout.
      `INSERT INTO revenus (id_utilisateur, id_categorie, montant, source, description, date_revenu)
       VALUES (?, ?, ?, ?, ?, ?)`, // Six valeurs, dans cet ordre.
    ).run(row.userId, row.categoryId, row.montant, row.source, row.description, row.date); // Exécute l'ajout.
    return Number(result.lastInsertRowid); // Numéro du nouveau revenu.
  } // Fin de la création. Le serveur appelle cette fonction.

  update(id, userId, row) { // Modifie un revenu existant. Le serveur actuel ne l'appelle pas.
    return this.db.prepare( // Prépare la modification.
      `UPDATE revenus
       SET id_categorie = ?, montant = ?, source = ?, description = ?, date_revenu = ? -- Nouvelles valeurs.
       WHERE id_revenu = ? AND id_utilisateur = ?`, // Seulement cette ligne, et seulement si elle appartient au compte.
    ).run(row.categoryId, row.montant, row.source, row.description, row.date, id, userId).changes; // Nombre de lignes modifiées.
  } // Fin de la modification.

  delete(id, userId) { // Supprime un revenu de ce compte.
    return this.db.prepare("DELETE FROM revenus WHERE id_revenu = ? AND id_utilisateur = ?").run(id, userId).changes; // 1 si supprimé, 0 si le revenu n'était pas à cet utilisateur.
  } // Fin de la suppression. Le serveur appelle cette fonction.

  total(userId, start, end) { // Additionne les revenus du compte entre deux dates.
    return this.db.prepare( // Prépare la somme.
      `SELECT COALESCE(SUM(montant), 0) AS total -- SUM additionne. COALESCE remplace « aucun revenu » par 0.
       FROM revenus WHERE id_utilisateur = ? AND date_revenu >= ? AND date_revenu <= ?`, // Compte, date de début, date de fin.
    ).get(userId, start, end).total; // On ne renvoie que le nombre total.
  } // Fin du total. Le serveur appelle cette fonction pour les soldes.
} // Fin de la classe IncomeRepository.
