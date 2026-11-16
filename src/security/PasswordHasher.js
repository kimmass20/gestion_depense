import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"; // Outils de cryptographie fournis par Node.js.

// Transforme un mot de passe en empreinte illisible, puis vérifie une saisie contre cette empreinte.
export class PasswordHasher {
  hash(password) { // password est le mot de passe en clair, seulement le temps de ce calcul.
    const salt = randomBytes(16).toString("hex"); // « Sel » : 16 octets au hasard, écrits en hexadécimal. Deux mots de passe identiques n'auront pas la même empreinte.
    const derived = scryptSync(password, salt, 32).toString("hex"); // scrypt mélange le mot de passe et le sel pour produire 32 octets. C'est volontairement lent, pour gêner les essais en masse.
    return `${salt}:${derived}`; // On garde le sel ET l'empreinte, séparés par deux-points. Sans le sel, on ne pourrait pas revérifier plus tard.
  } // Fin du calcul d'empreinte.

  verify(password, stored) { // Compare un mot de passe tapé avec le texte déjà enregistré (sel:empreinte).
    const [salt, derived] = String(stored).split(":"); // On sépare le sel et l'empreinte enregistrée.
    if (!salt || !derived) return false; // Si le texte enregistré est incomplet, on refuse.
    const actual = scryptSync(password, salt, 32); // On recalcule l'empreinte du mot de passe tapé, avec le même sel.
    const expected = Buffer.from(derived, "hex"); // On relit l'empreinte enregistrée comme une suite d'octets.
    if (actual.length !== expected.length) return false; // Si les longueurs diffèrent, ce n'est pas le bon mot de passe.
    return timingSafeEqual(actual, expected); // Compare les deux empreintes en un temps constant, pour ne pas donner d'indice sur le nombre de caractères justes.
  } // Fin de la vérification.
} // Fin de la classe PasswordHasher.
