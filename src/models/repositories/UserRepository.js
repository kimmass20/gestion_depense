// Cette classe lit et écrit la table des comptes (utilisateurs).
export class UserRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour toutes les fonctions ci-dessous.
  } // Fin du constructeur.

  findByEmail(email) { // Cherche un compte à partir de son e-mail.
    return this.db.prepare("SELECT * FROM utilisateurs WHERE email = ?").get(email) ?? null; // Le ? est remplacé par l'e-mail. S'il n'y a aucune ligne, on renvoie null (rien).
  } // Fin de la recherche par e-mail.

  findById(id) { // Cherche un compte à partir de son numéro.
    return this.db.prepare("SELECT * FROM utilisateurs WHERE id_utilisateur = ?").get(id) ?? null; // SELECT * prend toutes les colonnes. ?? null remplace « rien trouvé » par null.
  } // Fin de la recherche par numéro.

  insert({ nom, prenom, email, motDePasse, dateCreation }) { // Ajoute un compte. Les accolades récupèrent les champs par leur nom.
    const result = this.db.prepare( // Prépare l'ajout.
      `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, date_creation)
       VALUES (?, ?, ?, ?, ?)`, // Cinq points d'interrogation, dans le même ordre que les valeurs ci-dessous.
    ).run(nom, prenom, email, motDePasse, dateCreation); // Exécute l'ajout avec ces cinq valeurs.
    return Number(result.lastInsertRowid); // Renvoie le numéro donné automatiquement au nouveau compte.
  } // Fin de la création de compte.

  updateProfile(id, { nom, prenom, email }) { // Met à jour le nom, le prénom et l'e-mail d'un compte.
    this.db.prepare( // Prépare la modification.
      "UPDATE utilisateurs SET nom = ?, prenom = ?, email = ? WHERE id_utilisateur = ?", // Change seulement la ligne dont le numéro est id.
    ).run(nom, prenom, email, id); // Exécute avec les nouvelles valeurs, puis le numéro.
  } // Fin de la mise à jour du profil.

  updatePassword(id, motDePasse) { // Remplace l'empreinte du mot de passe. motDePasse est déjà l'empreinte, pas le texte clair.
    this.db.prepare("UPDATE utilisateurs SET mot_de_passe = ? WHERE id_utilisateur = ?").run(motDePasse, id); // Change la colonne mot_de_passe de ce compte seulement.
  } // Fin du changement de mot de passe.
} // Fin de la classe UserRepository.
