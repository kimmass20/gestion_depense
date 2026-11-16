// Outils pour lire un montant tapé par l'utilisateur et pour l'afficher en dollars.
export class Money {
  static parse(raw) { // static : on appelle Money.parse(...) sans créer d'objet. raw est le texte tapé.
    const normalized = String(raw ?? "").trim().replace(",", "."); // Transforme en texte, vide si rien, enlève les espaces, change la virgule en point.
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) { // Refuse si ce n'est pas un nombre positif avec au plus deux chiffres après le point.
      return { ok: false, error: "Le montant doit être un nombre positif, avec au plus deux décimales." }; // Échec : on renvoie le message d'erreur.
    } // Fin du contrôle de forme.
    const value = Number(normalized); // Convertit le texte en vrai nombre.
    if (!(value > 0)) { // Refuse zéro. Un nombre négatif a déjà été refusé par le test au-dessus.
      return { ok: false, error: "Le montant doit être strictement supérieur à zéro." }; // Échec : le montant doit être plus grand que zéro.
    } // Fin du contrôle « plus grand que zéro ».
    return { ok: true, value: Math.round(value * 100) / 100 }; // Succès : on arrondit au centime (deux chiffres après la virgule).
  } // Fin de la lecture d'un montant.

  static format(value) { // Transforme un nombre en texte monétaire français.
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(Number(value) || 0); // Exemple : 12.5 devient « 12,50 $US ». Si la valeur est vide, on affiche zéro.
  } // Fin de l'affichage d'un montant.
} // Fin de la classe Money.
