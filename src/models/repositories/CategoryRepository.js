// Cette classe lit et écrit la table des catégories.
export class CategoryRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour les fonctions suivantes.
  } // Fin du constructeur.

  listForUser(userId, type) { // Liste les catégories communes plus celles de cet utilisateur. type peut limiter à revenu ou dépense.
    const sql = `
      SELECT * FROM categories -- Toutes les colonnes de la catégorie.
      WHERE (id_utilisateur IS NULL OR id_utilisateur = ?) -- Communes à tous, ou appartenant à cet utilisateur.
        AND (? IS NULL OR type_categorie = ?) -- Si le type demandé est vide, on ne filtre pas. Sinon on garde ce type.
      ORDER BY type_categorie, nom_categorie -- Tri : d'abord le type, puis le nom.
    `; // Fin de la question SQL.
    return this.db.prepare(sql).all(userId, type ?? null, type ?? null); // all renvoie toutes les lignes. type ?? null transforme « absent » en NULL SQL.
  } // Fin de la liste des catégories.

  findVisible(id, userId) { // Retrouve une catégorie si elle est commune ou si elle appartient à cet utilisateur.
    return this.db.prepare( // Prépare la recherche.
      `SELECT * FROM categories
       WHERE id_categorie = ? AND (id_utilisateur IS NULL OR id_utilisateur = ?)`, // Empêche de prendre la catégorie privée de quelqu'un d'autre.
    ).get(id, userId) ?? null; // Une ligne, ou null si elle n'est pas visible.
  } // Fin de la recherche d'une catégorie visible.

  insert({ userId, nom, type }) { // Crée une catégorie personnelle.
    const result = this.db.prepare( // Prépare l'ajout.
      "INSERT INTO categories (id_utilisateur, nom_categorie, type_categorie) VALUES (?, ?, ?)", // Propriétaire, nom, type.
    ).run(userId, nom, type); // Exécute l'ajout.
    return Number(result.lastInsertRowid); // Numéro de la nouvelle catégorie.
  } // Fin de la création. Le serveur appelle cette fonction.

  update(id, userId, nom) { // Change le nom d'une catégorie personnelle. Le serveur actuel ne l'appelle pas.
    return this.db.prepare( // Prépare la modification.
      "UPDATE categories SET nom_categorie = ? WHERE id_categorie = ? AND id_utilisateur = ?", // Seulement si le numéro ET le propriétaire correspondent. Une catégorie commune (sans propriétaire) n'est pas modifiée.
    ).run(nom, id, userId).changes; // changes = nombre de lignes vraiment modifiées (0 ou 1).
  } // Fin du changement de nom.

  usageCount(id) { // Compte combien d'opérations utilisent encore cette catégorie. Le serveur actuel ne l'appelle pas.
    const revenus = this.db.prepare("SELECT COUNT(*) AS n FROM revenus WHERE id_categorie = ?").get(id).n; // Nombre de revenus liés.
    const depenses = this.db.prepare("SELECT COUNT(*) AS n FROM depenses WHERE id_categorie = ?").get(id).n; // Nombre de dépenses liées.
    const budgets = this.db.prepare("SELECT COUNT(*) AS n FROM budgets WHERE id_categorie = ?").get(id).n; // Nombre de budgets liés.
    return revenus + depenses + budgets; // Total des utilisations.
  } // Fin du comptage.

  delete(id, userId) { // Supprime une catégorie personnelle. Le serveur actuel ne l'appelle pas.
    return this.db.prepare( // Prépare la suppression.
      "DELETE FROM categories WHERE id_categorie = ? AND id_utilisateur = ?", // Refuse de supprimer une catégorie commune ou celle d'un autre compte.
    ).run(id, userId).changes; // 1 si une ligne a été supprimée, 0 sinon.
  } // Fin de la suppression.
} // Fin de la classe CategoryRepository.
