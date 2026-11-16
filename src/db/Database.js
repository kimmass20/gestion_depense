import fs from "node:fs"; // Outil Node.js pour créer des dossiers sur le disque.
import path from "node:path"; // Outil pour manipuler les chemins de fichiers (dossiers et noms).
import { DatabaseSync } from "node:sqlite"; // Ouvre une base SQLite : un seul fichier qui stocke les tables.

// Texte SQL qui crée les tables si elles n'existent pas encore.
// SQL est le langage des bases de données. Le -- en fin de ligne est un commentaire SQL, ignoré par SQLite.
const SCHEMA = `
PRAGMA foreign_keys = ON; -- Active les liens entre tables : une dépense doit pointer vers un vrai utilisateur.

CREATE TABLE IF NOT EXISTS utilisateurs ( -- Table des comptes. IF NOT EXISTS évite de la recréer au second lancement.
  id_utilisateur INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique, donné automatiquement (1, 2, 3...).
  nom TEXT NOT NULL, -- Nom de famille, texte obligatoire.
  prenom TEXT NOT NULL, -- Prénom, texte obligatoire.
  email TEXT NOT NULL UNIQUE, -- E-mail obligatoire, et un seul compte par e-mail.
  mot_de_passe TEXT NOT NULL, -- Empreinte du mot de passe, jamais le mot de passe en clair.
  date_creation TEXT NOT NULL -- Date de création du compte, enregistrée en texte.
); -- Fin de la table des utilisateurs.

CREATE TABLE IF NOT EXISTS categories ( -- Table des catégories (Transport, Salaire, etc.).
  id_categorie INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique de la catégorie.
  id_utilisateur INTEGER, -- Vide (NULL) si la catégorie est fournie par l'application, sinon numéro du propriétaire.
  nom_categorie TEXT NOT NULL, -- Nom affiché de la catégorie.
  type_categorie TEXT NOT NULL CHECK (type_categorie IN ('revenu', 'depense')), -- Seulement « revenu » ou « depense ».
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur) -- Le propriétaire doit exister dans la table utilisateurs.
); -- Fin de la table des catégories.

CREATE TABLE IF NOT EXISTS revenus ( -- Table des sommes d'argent reçues.
  id_revenu INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique du revenu.
  id_utilisateur INTEGER NOT NULL, -- Compte auquel appartient ce revenu.
  id_categorie INTEGER, -- Catégorie facultative.
  montant REAL NOT NULL CHECK (montant > 0), -- Somme en nombre décimal, obligatoirement plus grande que zéro.
  source TEXT NOT NULL, -- D'où vient l'argent (salaire, famille, etc.).
  description TEXT, -- Précision libre, facultative.
  date_revenu TEXT NOT NULL, -- Date du revenu, au format année-mois-jour.
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur), -- Lien vers le compte.
  FOREIGN KEY (id_categorie) REFERENCES categories(id_categorie) -- Lien vers la catégorie, si elle est renseignée.
); -- Fin de la table des revenus.

CREATE TABLE IF NOT EXISTS depenses ( -- Table des sommes d'argent dépensées.
  id_depense INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique de la dépense.
  id_utilisateur INTEGER NOT NULL, -- Compte auquel appartient cette dépense.
  id_categorie INTEGER NOT NULL, -- Catégorie obligatoire pour une dépense.
  montant REAL NOT NULL CHECK (montant > 0), -- Somme en nombre décimal, plus grande que zéro.
  moyen_paiement TEXT NOT NULL, -- Comment c'est payé : espèces, carte, etc.
  description TEXT, -- Précision libre, facultative.
  date_depense TEXT NOT NULL, -- Date de la dépense.
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur), -- Lien vers le compte.
  FOREIGN KEY (id_categorie) REFERENCES categories(id_categorie) -- Lien vers la catégorie.
); -- Fin de la table des dépenses.

CREATE TABLE IF NOT EXISTS budgets ( -- Table des plafonds de dépenses.
  id_budget INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique du budget.
  id_utilisateur INTEGER NOT NULL, -- Compte propriétaire du budget.
  id_categorie INTEGER, -- Vide si le budget couvre toutes les dépenses, sinon une catégorie.
  montant_limite REAL NOT NULL CHECK (montant_limite > 0), -- Plafond d'argent autorisé, plus grand que zéro.
  periode TEXT NOT NULL, -- Nom de la période enregistré avec le budget (le serveur met « mensuel »).
  date_debut TEXT NOT NULL, -- Premier jour où le budget s'applique.
  date_fin TEXT NOT NULL, -- Dernier jour où le budget s'applique.
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur), -- Lien vers le compte.
  FOREIGN KEY (id_categorie) REFERENCES categories(id_categorie) -- Lien vers la catégorie, si le budget n'est pas global.
); -- Fin de la table des budgets.

CREATE TABLE IF NOT EXISTS notifications ( -- Table des messages d'alerte pour l'utilisateur.
  id_notification INTEGER PRIMARY KEY AUTOINCREMENT, -- Numéro unique du message.
  id_utilisateur INTEGER NOT NULL, -- Compte qui doit voir ce message.
  titre TEXT NOT NULL, -- Titre court du message.
  message TEXT NOT NULL, -- Texte du message.
  date_notification TEXT NOT NULL, -- Moment où le message a été créé.
  statut_lecture INTEGER NOT NULL DEFAULT 0, -- 0 = pas encore lu, 1 = déjà lu. 0 est la valeur de départ.
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur) -- Lien vers le compte.
); -- Fin de la table des notifications.
`; // Fin du texte SQL de création.

// Catégories déjà prêtes pour tout le monde. Chaque ligne : nom, puis type.
const PREDEFINED = [
  ["Argent de poche", "revenu"], // Revenu : argent de poche.
  ["Salaire", "revenu"], // Revenu : salaire.
  ["Bourse d'études", "revenu"], // Revenu : bourse.
  ["Activité commerciale", "revenu"], // Revenu : activité commerciale.
  ["Aide familiale", "revenu"], // Revenu : aide de la famille.
  ["Autres revenus", "revenu"], // Revenu : tout le reste.
  ["Transport", "depense"], // Dépense : transport.
  ["Alimentation", "depense"], // Dépense : alimentation.
  ["Logement", "depense"], // Dépense : logement.
  ["Frais académiques", "depense"], // Dépense : frais d'études.
  ["Communication", "depense"], // Dépense : téléphone, internet.
  ["Santé", "depense"], // Dépense : santé.
  ["Habillement", "depense"], // Dépense : vêtements.
  ["Loisirs", "depense"], // Dépense : loisirs.
  ["Autres dépenses", "depense"], // Dépense : tout le reste.
]; // Fin de la liste des catégories de départ.

// Classe qui ouvre la base et prépare les tables. Une classe est un modèle d'objet.
export class AppDatabase {
  constructor(filePath) { // Appelé quand on crée la base. filePath est le chemin du fichier .sqlite.
    fs.mkdirSync(path.dirname(filePath), { recursive: true }); // Crée le dossier du fichier s'il manque, y compris les dossiers parents.
    this.db = new DatabaseSync(filePath); // Ouvre (ou crée) le fichier de base et le garde dans this.db.
    this.db.exec(SCHEMA); // Exécute le SQL ci-dessus : crée les tables manquantes.
    this.#seedCategories(); // Ajoute les catégories de départ si elles ne sont pas déjà là.
  } // Fin du constructeur.

  #seedCategories() { // Le # rend cette fonction privée : utilisable seulement à l'intérieur de la classe.
    const row = this.db.prepare( // Prépare une question SQL réutilisable. Le ? sera remplacé plus tard, ici il n'y en a pas.
      "SELECT COUNT(*) AS n FROM categories WHERE id_utilisateur IS NULL", // Compte les catégories communes (sans propriétaire).
    ).get(); // Exécute la question et récupère une seule ligne.
    if (row.n > 0) return; // S'il y en a déjà, on s'arrête pour ne pas les dupliquer.
    const insert = this.db.prepare( // Prépare l'ajout d'une catégorie commune.
      "INSERT INTO categories (id_utilisateur, nom_categorie, type_categorie) VALUES (NULL, ?, ?)", // NULL = pas de propriétaire. Les ? recevront le nom et le type.
    ); // Fin de la préparation.
    for (const [nom, type] of PREDEFINED) insert.run(nom, type); // Pour chaque couple nom/type, on insère une ligne.
  } // Fin de l'ajout des catégories de départ.
} // Fin de la classe AppDatabase.
