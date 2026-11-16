// Début de la question commune : une dépense avec le nom de sa catégorie.
// JOIN (et non LEFT JOIN) : une dépense sans catégorie correspondante n'apparaît pas.
const SELECT = `
  SELECT d.*, c.nom_categorie -- d.* = toutes les colonnes de la dépense.
  FROM depenses d -- La table depenses est surnommée d.
  JOIN categories c ON c.id_categorie = d.id_categorie -- On rattache la catégorie obligatoire.
`; // Fin du morceau SQL réutilisé.

// Cette classe lit et écrit la table des dépenses.
export class ExpenseRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour les fonctions suivantes.
  } // Fin du constructeur.

  list(userId, { start, end, categoryId, query } = {}) { // Liste les dépenses d'un compte, avec filtres facultatifs.
    const like = query ? `%${query}%` : null; // Si un mot est cherché, %mot% veut dire « contient ce mot ». Sinon, pas de filtre texte.
    return this.db.prepare( // Prépare la question.
      `${SELECT}
       WHERE d.id_utilisateur = ? -- Seulement les dépenses de ce compte.
         AND (? IS NULL OR d.date_depense >= ?) -- Filtre de date de début, ignoré si la date est vide.
         AND (? IS NULL OR d.date_depense <= ?) -- Filtre de date de fin.
         AND (? IS NULL OR d.id_categorie = ?) -- Filtre de catégorie.
         AND (? IS NULL OR d.description LIKE ? OR c.nom_categorie LIKE ? OR d.moyen_paiement LIKE ?) -- Recherche dans la description, le nom de catégorie ou le moyen de paiement.
       ORDER BY d.date_depense DESC, d.id_depense DESC`, // Plus récent d'abord.
    ).all( // Exécute et renvoie toutes les lignes trouvées.
      userId, // Numéro du compte.
      start ?? null, start ?? null, // Date de début, deux fois (test vide, puis comparaison).
      end ?? null, end ?? null, // Date de fin, deux fois.
      categoryId ?? null, categoryId ?? null, // Catégorie, deux fois.
      like, like, like, like, // Le texte cherché : un test « est-il vide ? », puis trois comparaisons.
    ); // Fin des valeurs.
  } // Fin de la liste. Le serveur appelle cette fonction.

  find(id, userId) { // Retrouve une seule dépense de ce compte. Le serveur actuel ne l'appelle pas.
    return this.db.prepare(`${SELECT} WHERE d.id_depense = ? AND d.id_utilisateur = ?`).get(id, userId) ?? null; // null si elle n'existe pas ou appartient à un autre compte.
  } // Fin de la recherche d'une dépense.

  insert(row) { // Ajoute une dépense.
    const result = this.db.prepare( // Prépare l'ajout.
      `INSERT INTO depenses (id_utilisateur, id_categorie, montant, moyen_paiement, description, date_depense)
       VALUES (?, ?, ?, ?, ?, ?)`, // Six valeurs.
    ).run(row.userId, row.categoryId, row.montant, row.moyenPaiement, row.description, row.date); // Exécute l'ajout.
    return Number(result.lastInsertRowid); // Numéro de la nouvelle dépense.
  } // Fin de la création. Le serveur appelle cette fonction.

  update(id, userId, row) { // Modifie une dépense. Le serveur actuel ne l'appelle pas.
    return this.db.prepare( // Prépare la modification.
      `UPDATE depenses
       SET id_categorie = ?, montant = ?, moyen_paiement = ?, description = ?, date_depense = ? -- Nouvelles valeurs.
       WHERE id_depense = ? AND id_utilisateur = ?`, // Seulement cette dépense, et seulement pour son propriétaire.
    ).run(row.categoryId, row.montant, row.moyenPaiement, row.description, row.date, id, userId).changes; // Nombre de lignes modifiées.
  } // Fin de la modification.

  delete(id, userId) { // Supprime une dépense de ce compte.
    return this.db.prepare("DELETE FROM depenses WHERE id_depense = ? AND id_utilisateur = ?").run(id, userId).changes; // 1 si supprimée, 0 sinon.
  } // Fin de la suppression. Le serveur appelle cette fonction.

  total(userId, start, end, categoryId = null) { // Additionne les dépenses entre deux dates. categoryId vide = toutes les catégories.
    return this.db.prepare( // Prépare la somme.
      `SELECT COALESCE(SUM(montant), 0) AS total -- Somme, ou 0 s'il n'y a aucune dépense.
       FROM depenses
       WHERE id_utilisateur = ? AND date_depense >= ? AND date_depense <= ? -- Compte et intervalle de dates.
         AND (? IS NULL OR id_categorie = ?)`, // Catégorie facultative.
    ).get(userId, start, end, categoryId, categoryId).total; // On renvoie seulement le nombre.
  } // Fin du total. Utilisé pour le solde et les budgets.

  byCategory(userId, start, end) { // Total des dépenses par catégorie, sur une période.
    return this.db.prepare( // Prépare le regroupement.
      `SELECT c.nom_categorie AS nom, COALESCE(SUM(d.montant), 0) AS total -- Nom de la catégorie et somme dépensée.
       FROM depenses d
       JOIN categories c ON c.id_categorie = d.id_categorie -- Pour avoir le nom.
       WHERE d.id_utilisateur = ? AND d.date_depense >= ? AND d.date_depense <= ? -- Ce compte, entre les deux dates.
       GROUP BY c.id_categorie -- Une ligne par catégorie.
       ORDER BY total DESC`, // La catégorie la plus chère en premier.
    ).all(userId, start, end); // Liste des catégories avec leur total.
  } // Fin du regroupement. Le tableau de bord et les statistiques l'utilisent.
} // Fin de la classe ExpenseRepository.
