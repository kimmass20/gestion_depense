// Cette classe lit et écrit la table des notifications (messages d'alerte).
export class NotificationRepository {
  constructor(db) { // Reçoit la base déjà ouverte.
    this.db = db; // On la garde pour les fonctions suivantes.
  } // Fin du constructeur.

  list(userId) { // Liste les messages d'un compte, du plus récent au plus ancien.
    return this.db.prepare( // Prépare la question.
      `SELECT * FROM notifications WHERE id_utilisateur = ? -- Seulement ce compte.
       ORDER BY date_notification DESC, id_notification DESC`, // Date décroissante, puis numéro décroissant.
    ).all(userId); // Toutes les notifications de ce compte.
  } // Fin de la liste.

  unreadCount(userId) { // Compte les messages pas encore lus.
    return this.db.prepare( // Prépare le comptage.
      "SELECT COUNT(*) AS n FROM notifications WHERE id_utilisateur = ? AND statut_lecture = 0", // statut_lecture 0 = non lu.
    ).get(userId).n; // On renvoie seulement le nombre n.
  } // Fin du comptage. Le tableau de bord l'affiche comme un badge.

  insert({ userId, titre, message, date }) { // Ajoute un message. Les accolades prennent les champs par leur nom.
    this.db.prepare( // Prépare l'ajout.
      `INSERT INTO notifications (id_utilisateur, titre, message, date_notification, statut_lecture)
       VALUES (?, ?, ?, ?, 0)`, // Le 0 final veut dire « pas encore lu ».
    ).run(userId, titre, message, date); // Exécute l'ajout.
  } // Fin de la création.

  markAllRead(userId) { // Marque tous les messages de ce compte comme lus.
    this.db.prepare( // Prépare la modification.
      "UPDATE notifications SET statut_lecture = 1 WHERE id_utilisateur = ?", // 1 = lu.
    ).run(userId); // Applique à ce compte seulement.
  } // Fin du marquage. Le serveur le fait quand l'utilisateur ouvre la page des notifications.
} // Fin de la classe NotificationRepository.
