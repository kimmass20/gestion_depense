import fs from "node:fs"; // Outils pour créer un dossier, tester si un fichier existe et le copier.
import path from "node:path"; // Outils pour construire des chemins de fichiers selon le système (Windows ou autre).
import express from "express"; // Express : bibliothèque qui crée le serveur web et relie les adresses aux fonctions.
import session from "express-session"; // Garde en mémoire qui est connecté, grâce à un cookie (petit jeton du navigateur).
import { AppDatabase } from "../src/db/Database.js"; // Classe qui ouvre le fichier SQLite et crée les tables.
import { PasswordHasher } from "../src/security/PasswordHasher.js"; // Classe qui transforme le mot de passe en empreinte illisible.
import { UserRepository } from "../src/models/repositories/UserRepository.js"; // Lecture et écriture des comptes.
import { CategoryRepository } from "../src/models/repositories/CategoryRepository.js"; // Lecture et écriture des catégories.
import { IncomeRepository } from "../src/models/repositories/IncomeRepository.js"; // Lecture et écriture des revenus.
import { ExpenseRepository } from "../src/models/repositories/ExpenseRepository.js"; // Lecture et écriture des dépenses.
import { BudgetRepository } from "../src/models/repositories/BudgetRepository.js"; // Lecture et écriture des budgets.
import { NotificationRepository } from "../src/models/repositories/NotificationRepository.js"; // Lecture et écriture des messages d'alerte.
import { FinanceService } from "../src/models/FinanceService.js"; // Calculs de solde, d'état de budget et d'alertes.
import { Period } from "../src/models/Period.js"; // Calcul des dates : jour, semaine, mois, année.
import { Money } from "../src/models/Money.js"; // Vérifie qu'un montant tapé est un nombre positif.
import { publicUser } from "../src/presenters/AuthPresenter.js"; // Retire le mot de passe avant d'envoyer le compte au navigateur.

const root = import.meta.dirname; // Dossier de ce fichier, c'est-à-dire le dossier serveur.
const client = path.resolve(root, "../client"); // Chemin absolu du dossier client, qui contient la page web.
const dataDir = path.join(root, "donnees"); // Dossier serveur/donnees, où sera le fichier de base.
const dbPath = path.join(dataDir, "depenses.sqlite"); // Chemin du fichier SQLite utilisé maintenant.
const legacyDb = path.resolve(root, "../data/depenses.sqlite"); // Ancien emplacement possible de la base, à la racine du projet.
fs.mkdirSync(dataDir, { recursive: true }); // Crée le dossier donnees s'il n'existe pas.
if (!fs.existsSync(dbPath) && fs.existsSync(legacyDb)) fs.copyFileSync(legacyDb, dbPath); // Si la nouvelle base n'existe pas mais l'ancienne oui, on copie l'ancienne pour ne pas perdre les données.

const database = new AppDatabase(dbPath); // Ouvre la base et crée les tables manquantes.
const db = database.db; // Raccourci vers la connexion SQLite.
const users = new UserRepository(db); // Objet qui parle à la table des comptes.
const categories = new CategoryRepository(db); // Objet qui parle à la table des catégories.
const incomes = new IncomeRepository(db); // Objet qui parle à la table des revenus.
const expenses = new ExpenseRepository(db); // Objet qui parle à la table des dépenses.
const budgets = new BudgetRepository(db); // Objet qui parle à la table des budgets.
const notifications = new NotificationRepository(db); // Objet qui parle à la table des notifications.
const finance = new FinanceService({ incomes, expenses, budgets, notifications }); // Objet qui fait les calculs en s'appuyant sur ces quatre accès.
const passwords = new PasswordHasher(); // Objet qui calcule et vérifie les empreintes de mots de passe.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Modèle simple d'e-mail : quelque chose, arobase, quelque chose, point, quelque chose, sans espace.

const app = express(); // Crée l'application serveur, encore sans adresse.
app.use(express.json()); // Lit le corps des requêtes envoyé en JSON (texte structuré) et le met dans req.body.
app.use(session({ // Active les sessions : souvenir de l'utilisateur entre deux clics.
  secret: process.env.SESSION_SECRET || "depenses-tp-mri", // Texte secret pour signer le cookie. On prend la variable d'environnement si elle existe, sinon ce texte de démonstration.
  resave: false, // Ne réécrit pas la session à chaque requête si elle n'a pas changé.
  saveUninitialized: false, // Ne crée pas de session tant que personne ne s'est connecté.
  cookie: { httpOnly: true, sameSite: "lax" }, // httpOnly : le JavaScript de la page ne peut pas lire ce cookie. sameSite lax : le cookie n'est pas envoyé lors d'un appel lancé depuis un autre site.
})); // Fin du réglage des sessions.

function requireUser(req, res) { // Vérifie qu'une personne est connectée. req est la demande, res est la réponse.
  if (!req.session.user) { // Pas d'utilisateur dans la session.
    res.status(401).json({ errors: ["Authentification requise."] }); // Code 401 : accès refusé. On envoie un message d'erreur en JSON.
    return null; // L'appelant saura qu'il faut s'arrêter.
  } // Fin du refus.
  return req.session.user; // On renvoie le compte connecté (déjà sans mot de passe).
} // Fin du contrôle de connexion.

app.post("/api/inscription", (req, res) => { // Adresse appelée quand le formulaire de création de compte est envoyé. POST = envoi de données.
  const nom = String(req.body.nom || "").trim(); // Nom, transformé en texte, ou vide, sans espaces aux bords.
  const prenom = String(req.body.prenom || "").trim(); // Prénom, même traitement.
  const email = String(req.body.email || "").trim().toLowerCase(); // E-mail sans espaces, en minuscules, pour éviter les doublons A/a.
  const password = String(req.body.mot_de_passe || ""); // Mot de passe. On ne coupe pas les espaces : ils peuvent faire partie du mot de passe.
  const errors = []; // Liste vide des messages d'erreur, remplie ci-dessous.
  if (!nom || !prenom) errors.push("Le nom et le prénom sont obligatoires."); // Refuse si l'un des deux est vide.
  if (!EMAIL.test(email)) errors.push("L'adresse e-mail est invalide."); // Refuse si l'e-mail ne ressemble pas à un e-mail.
  if (password.length < 8) errors.push("Le mot de passe doit contenir au moins 8 caractères."); // Longueur minimale : 8 caractères.
  if (password !== String(req.body.confirmation || "")) errors.push("La confirmation ne correspond pas."); // Les deux saisies du mot de passe doivent être identiques.
  if (!errors.length && users.findByEmail(email)) errors.push("Un compte existe déjà avec cet e-mail."); // On ne cherche le doublon que si le reste est valide. findByEmail renvoie le compte s'il existe.
  if (errors.length) return res.status(422).json({ errors }); // Code 422 : les données envoyées ne sont pas acceptables. On s'arrête ici.
  const id = users.insert({ nom, prenom, email, motDePasse: passwords.hash(password), dateCreation: new Date().toISOString() }); // Crée le compte. hash remplace le mot de passe par son empreinte. toISOString est la date du moment en texte.
  req.session.user = publicUser(users.findById(id)); // Connecte tout de suite la personne, sans le mot de passe dans la session.
  res.status(201).json({ user: req.session.user }); // Code 201 : créé. On renvoie le compte public.
}); // Fin de l'inscription.

app.post("/api/connexion", (req, res) => { // Adresse de connexion.
  const email = String(req.body.email || "").trim().toLowerCase(); // E-mail nettoyé, en minuscules.
  const user = users.findByEmail(email); // Cherche le compte. Peut valoir null.
  if (!user || !passwords.verify(String(req.body.mot_de_passe || ""), user.mot_de_passe)) { // Compte introuvable, ou empreinte qui ne correspond pas au mot de passe tapé.
    return res.status(401).json({ errors: ["E-mail ou mot de passe incorrect."] }); // Même message dans les deux cas, pour ne pas dire si l'e-mail existe.
  } // Fin du refus.
  req.session.user = publicUser(user); // Mémorise le compte dans la session, sans le mot de passe.
  res.json({ user: req.session.user }); // Renvoie le compte. Pas de code précisé : Express met 200, « tout va bien ».
}); // Fin de la connexion.

app.post("/api/deconnexion", (req, res) => { // Adresse de déconnexion.
  req.session.destroy(() => res.json({ ok: true })); // Détruit la session, puis répond { ok: true } quand c'est fini.
}); // Fin de la déconnexion.

app.get("/api/session", (req, res) => { // Adresse lue au chargement de la page pour savoir si quelqu'un est déjà connecté. GET = lecture.
  res.json({ user: req.session.user || null }); // Le compte en session, ou null si personne n'est connecté.
}); // Fin de la lecture de session.

app.get("/api/tableau", (req, res) => { // Données du tableau de bord.
  const user = requireUser(req, res); // Refuse si personne n'est connecté.
  if (!user) return; // requireUser a déjà répondu : on quitte la fonction.
  const rangeName = ["jour", "semaine", "mois", "annee"].includes(req.query.periode) ? req.query.periode : "mois"; // Période demandée dans l'adresse (?periode=). Si elle est inconnue, on prend le mois.
  const range = Period.range(rangeName); // Transforme ce nom en deux dates et un libellé.
  const summary = finance.summary(user.id, range); // Revenus, dépenses et solde sur cette période.
  const recent = [ // Liste des dernières opérations, revenus et dépenses mélangés.
    ...incomes.list(user.id, range).slice(0, 5).map((row) => ({ date: row.date_revenu, kind: "Revenu", label: row.source, montant: row.montant })), // Au plus 5 revenus, remis dans une forme simple. Les ... étalent ce tableau dans la liste.
    ...expenses.list(user.id, range).slice(0, 5).map((row) => ({ date: row.date_depense, kind: "Dépense", label: row.nom_categorie, montant: row.montant })), // Au plus 5 dépenses, même forme.
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8); // Tri du plus récent au plus ancien, puis on ne garde que 8 lignes.
  const today = new Date().toISOString().slice(0, 10); // Date du jour au format année-mois-jour (les 10 premiers caractères).
  const budgetCards = budgets.list(user.id) // Tous les budgets du compte.
    .filter((item) => item.date_debut <= today && item.date_fin >= today) // On garde ceux qui couvrent aujourd'hui.
    .map((item) => ({ nom: item.nom_categorie || "Budget global", global: !item.id_categorie, limit: item.montant_limite, ...finance.budgetStatus(item) })); // Carte prête à afficher : nom, plafond, et l'état calculé (dépensé, reste, niveau).
  const globalBudget = budgetCards.find((item) => item.global); // Le budget sans catégorie, s'il y en a un en cours.
  const budgetDisponible = budgetCards.length // S'il existe au moins un budget en cours...
    ? (globalBudget ? globalBudget.remaining : budgetCards.reduce((sum, item) => sum + item.remaining, 0)) // ...on prend le reste du budget global, sinon on additionne les restes des budgets de catégories.
    : null; // ...sinon aucun budget : null, pour que la page affiche « Aucun budget » et pas zéro.
  res.json({ // Réponse envoyée à la page.
    rangeName, // Nom de la période choisie.
    rangeLabel: range.label, // Texte du genre « Ce mois ».
    summary, // Revenus, dépenses, solde de la période.
    soldeActuel: finance.lifetimeBalance(user.id), // Solde de tout l'historique.
    budgetDisponible, // Reste du budget, ou null.
    recent, // Dernières opérations.
    categories: expenses.byCategory(user.id, range.start, range.end).slice(0, 5), // Cinq catégories les plus coûteuses sur la période. La page du tableau de bord reçue ici ne dessine pas cette liste ; le champ est quand même calculé.
    series: Period.monthWindow(6).map((month) => ({ label: month.label, total: expenses.total(user.id, month.start, month.end) })), // Total dépensé pour chacun des 6 derniers mois, pour le graphique.
    budgets: budgetCards, // Budgets en cours avec leur état.
    unread: notifications.unreadCount(user.id), // Nombre de notifications non lues.
  }); // Fin de la réponse du tableau de bord.
}); // Fin de l'adresse /api/tableau.

app.get("/api/categories", (req, res) => { // Liste des catégories visibles par le compte.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Déjà répondu si personne n'est connecté.
  res.json({ categories: categories.listForUser(user.id, req.query.type || null) }); // type dans l'adresse peut valoir revenu ou depense. Vide = les deux.
}); // Fin de la liste des catégories.

app.post("/api/categories", (req, res) => { // Création d'une catégorie personnelle.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const nom = String(req.body.nom || "").trim(); // Nom demandé, sans espaces aux bords.
  const type = req.body.type === "revenu" ? "revenu" : "depense"; // Seul le mot exact « revenu » est accepté. Tout le reste devient « depense ».
  if (nom.length < 2) return res.status(422).json({ errors: ["Le nom de la catégorie est trop court."] }); // Au moins 2 caractères.
  const duplicate = categories.listForUser(user.id, type).some((item) => item.nom_categorie.toLowerCase() === nom.toLowerCase()); // Vrai si une catégorie visible du même type a déjà ce nom, sans tenir compte des majuscules.
  if (duplicate) return res.status(422).json({ errors: ["Cette catégorie existe déjà."] }); // On refuse le doublon.
  categories.insert({ userId: user.id, nom, type }); // Enregistre la catégorie au nom de ce compte.
  res.status(201).json({ ok: true }); // Code 201 : créée.
}); // Fin de la création de catégorie.

app.get("/api/revenus", (req, res) => { // Liste de tous les revenus du compte, sans filtre de date.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  res.json({ revenus: incomes.list(user.id) }); // La liste vient de la table revenus.
}); // Fin de la liste des revenus.

app.post("/api/revenus/:id/supprimer", (req, res) => { // Suppression d'un revenu. :id est le numéro dans l'adresse.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  incomes.delete(Number(req.params.id), user.id); // Supprime seulement si ce revenu appartient au compte connecté.
  res.json({ ok: true }); // Réponse simple. Même si aucune ligne n'a été supprimée, la réponse reste ok.
}); // Fin de la suppression d'un revenu.

app.post("/api/revenus", (req, res) => { // Enregistrement d'un nouveau revenu.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const parsed = parseIncome(req, user.id); // Vérifie le formulaire et prépare la ligne.
  if (parsed.errors.length) return res.status(422).json(parsed); // S'il y a des erreurs, on les renvoie et on n'enregistre rien.
  incomes.insert({ userId: user.id, ...parsed.row }); // Enregistre. Les ... copient montant, source, description, date et catégorie.
  finance.notifyOperation(user.id, "Revenu enregistré", `Revenu de ${parsed.row.source} enregistré.`); // Ajoute une notification avec le nom de la source.
  res.status(201).json({ ok: true }); // Code 201 : créé.
}); // Fin de la création d'un revenu.

app.get("/api/depenses", (req, res) => { // Liste des dépenses, avec recherche et filtres facultatifs.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const periode = ["jour", "semaine", "mois", "annee"].includes(req.query.periode) ? req.query.periode : ""; // Période seulement si le mot est connu. Sinon, pas de filtre de date.
  res.json({ // Réponse.
    depenses: expenses.list(user.id, { // Liste filtrée.
      query: String(req.query.q || "").trim(), // Mot cherché dans l'adresse (?q=), ou texte vide.
      categoryId: req.query.categorie ? Number(req.query.categorie) : null, // Numéro de catégorie, ou null.
      ...(periode ? Period.range(periode) : {}), // Si une période est demandée, on ajoute ses dates start et end. Sinon, objet vide.
    }), // Fin des filtres.
  }); // Fin de la réponse.
}); // Fin de la liste des dépenses.

app.post("/api/depenses/:id/supprimer", (req, res) => { // Suppression d'une dépense. :id est son numéro.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  expenses.delete(Number(req.params.id), user.id); // Supprime seulement la dépense de ce compte.
  res.json({ ok: true }); // Réponse simple.
}); // Fin de la suppression d'une dépense.

app.post("/api/depenses", (req, res) => { // Enregistrement d'une nouvelle dépense.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const parsed = parseExpense(req, user.id); // Vérifie le formulaire.
  if (parsed.errors.length) return res.status(422).json(parsed); // Erreurs : on n'enregistre pas.
  expenses.insert({ userId: user.id, ...parsed.row }); // Enregistre la dépense.
  finance.notifyOperation(user.id, "Dépense enregistrée", "La dépense a été enregistrée."); // Notification simple.
  finance.notifyBudgets(user.id, parsed.row.date, parsed.row.categoryId); // Alertes si un budget couvrant ce jour est presque plein ou dépassé.
  res.status(201).json({ ok: true }); // Code 201 : créée.
}); // Fin de la création d'une dépense.

app.get("/api/budgets", (req, res) => { // Liste des budgets avec leur état (dépensé, reste, niveau).
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  res.json({ // Réponse.
    budgets: budgets.list(user.id).map((item) => ({ ...item, ...finance.budgetStatus(item) })), // Chaque budget de la table, plus spent, remaining et level.
  }); // Fin de la réponse.
}); // Fin de la liste des budgets.

app.post("/api/budgets", (req, res) => { // Création d'un budget.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const errors = []; // Messages d'erreur à remplir.
  const montant = readAmount(req.body.montant, errors); // Montant du plafond. Une erreur est ajoutée à la liste si le texte est invalide.
  const dateDebut = readDate(req.body.date_debut, errors, "La date de début"); // Première date, avec un libellé pour le message d'erreur.
  const dateFin = readDate(req.body.date_fin, errors, "La date de fin"); // Dernière date.
  if (dateDebut && dateFin && dateFin < dateDebut) errors.push("La date de fin doit suivre la date de début."); // Comparaison de textes année-mois-jour : l'ordre alphabétique est aussi l'ordre des dates.
  let categoryId = req.body.categorie ? Number(req.body.categorie) : null; // Numéro de catégorie, ou null pour un budget global.
  if (categoryId) { // Seulement si une catégorie a été choisie.
    const category = categories.findVisible(categoryId, user.id); // Catégorie commune ou personnelle de ce compte.
    if (!category || category.type_categorie !== "depense") errors.push("Le budget doit porter sur une catégorie de dépense."); // Refuse une catégorie inconnue ou une catégorie de revenu.
  } // Fin du contrôle de catégorie.
  if (errors.length) return res.status(422).json({ errors }); // On n'enregistre pas s'il y a une erreur.
  budgets.insert({ userId: user.id, categoryId, montant, periode: "mensuel", dateDebut, dateFin }); // Enregistre. Le texte « mensuel » est stocké tel quel ; les vraies bornes sont les deux dates.
  res.status(201).json({ ok: true }); // Code 201 : créé.
}); // Fin de la création d'un budget.

app.get("/api/historique", (req, res) => { // Revenus et dépenses mélangés, pour la page Historique.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const periode = ["jour", "semaine", "mois", "annee", "tout"].includes(req.query.periode) ? req.query.periode : "mois"; // Période connue, sinon le mois. « tout » est accepté ici.
  const range = periode === "tout" ? { start: "0001-01-01", end: "9999-12-31" } : Period.range(periode); // « tout » couvre toutes les dates. Sinon on calcule la période.
  const filter = { ...range, categoryId: req.query.categorie ? Number(req.query.categorie) : null }; // Dates plus un filtre de catégorie facultatif.
  const rows = []; // Liste qu'on va remplir.
  if (req.query.type !== "depense") { // On ajoute les revenus sauf si l'adresse demande seulement les dépenses.
    rows.push(...incomes.list(user.id, filter).map((row) => ({ date: row.date_revenu, kind: "Revenu", montant: row.montant, category: row.nom_categorie || row.source, description: row.description || "" }))); // Forme commune. Sans catégorie, on montre la source.
  } // Fin de l'ajout des revenus.
  if (req.query.type !== "revenu") { // On ajoute les dépenses sauf si l'adresse demande seulement les revenus.
    rows.push(...expenses.list(user.id, filter).map((row) => ({ date: row.date_depense, kind: "Dépense", montant: row.montant, category: row.nom_categorie, description: row.description || "" }))); // Forme commune pour une dépense.
  } // Fin de l'ajout des dépenses.
  rows.sort((a, b) => b.date.localeCompare(a.date)); // Plus récent en haut.
  res.json({ operations: rows }); // La page lit le champ operations.
}); // Fin de l'historique. La page actuelle appelle cette adresse avec periode=tout et sans filtre de type.

app.get("/api/statistiques", (req, res) => { // Chiffres du mois en cours et des six derniers mois.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const range = Period.range("mois"); // Du premier au dernier jour du mois actuel.
  res.json({ // Réponse.
    summary: finance.summary(user.id, range), // Revenus, dépenses et solde de ce mois.
    categories: expenses.byCategory(user.id, range.start, range.end), // Dépenses du mois regroupées par catégorie.
    series: Period.monthWindow(6).map((month) => ({ label: month.label, ...finance.summary(user.id, month) })), // Pour chaque mois : libellé, revenus, dépenses et solde.
  }); // Fin de la réponse.
}); // Fin des statistiques.

app.get("/api/notifications", (req, res) => { // Liste des messages, puis ils sont marqués comme lus.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const items = notifications.list(user.id); // On lit d'abord, pour encore connaître l'état « non lu » au moment de la lecture.
  notifications.markAllRead(user.id); // Ensuite tout passe à « lu » pour ce compte.
  res.json({ notifications: items }); // On renvoie la liste lue avant le marquage.
}); // Fin des notifications.

app.get("/api/profil", (req, res) => { // Lecture du nom, du prénom et de l'e-mail.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const row = users.findById(user.id); // Relit le compte dans la base, pas seulement la copie de session.
  res.json({ user: { nom: row.nom, prenom: row.prenom, email: row.email } }); // Trois champs seulement.
}); // Fin de la lecture du profil.

app.post("/api/profil", (req, res) => { // Enregistrement du nom, du prénom et de l'e-mail.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const nom = String(req.body.nom || "").trim(); // Nouveau nom.
  const prenom = String(req.body.prenom || "").trim(); // Nouveau prénom.
  const email = String(req.body.email || "").trim().toLowerCase(); // Nouvel e-mail, en minuscules.
  const errors = []; // Messages d'erreur.
  if (!nom || !prenom) errors.push("Le nom et le prénom sont obligatoires."); // Les deux sont requis.
  if (!EMAIL.test(email)) errors.push("L'adresse e-mail est invalide."); // Forme de l'e-mail.
  const existing = users.findByEmail(email); // Cherche si cet e-mail est déjà pris.
  if (existing && existing.id_utilisateur !== user.id) errors.push("Cet e-mail est déjà utilisé."); // Autorisé si c'est encore le même compte.
  if (errors.length) return res.status(422).json({ errors }); // On ne modifie rien en cas d'erreur.
  users.updateProfile(user.id, { nom, prenom, email }); // Écrit les trois champs.
  req.session.user = publicUser(users.findById(user.id)); // Met à jour la session pour que le menu affiche les nouveaux nom et e-mail.
  res.json({ user: req.session.user }); // Renvoie le compte public à jour.
}); // Fin de la mise à jour du profil.

app.post("/api/profil/mot-de-passe", (req, res) => { // Changement du mot de passe.
  const user = requireUser(req, res); // Connexion obligatoire.
  if (!user) return; // Arrêt si non connecté.
  const row = users.findById(user.id); // Relit le compte pour avoir l'empreinte actuelle. La session ne la contient pas.
  const errors = []; // Messages d'erreur.
  if (!passwords.verify(String(req.body.actuel || ""), row.mot_de_passe)) errors.push("Le mot de passe actuel est incorrect."); // L'ancien mot de passe doit correspondre.
  const next = String(req.body.nouveau || ""); // Nouveau mot de passe tapé.
  if (next.length < 8) errors.push("Le nouveau mot de passe doit contenir au moins 8 caractères."); // Même règle que à l'inscription.
  if (next !== String(req.body.confirmation || "")) errors.push("La confirmation ne correspond pas."); // Les deux saisies doivent être identiques.
  if (errors.length) return res.status(422).json({ errors }); // On ne change rien en cas d'erreur.
  users.updatePassword(user.id, passwords.hash(next)); // Enregistre seulement l'empreinte du nouveau mot de passe.
  res.json({ ok: true }); // Succès. La session reste ouverte.
}); // Fin du changement de mot de passe.

app.use(express.static(client)); // Pour toute adresse qui n'est pas une /api déjà définie, on sert les fichiers du dossier client (page, style, scripts).

function parseIncome(req, userId) { // Vérifie le formulaire d'un revenu et prépare la ligne à enregistrer.
  const errors = []; // Messages d'erreur.
  const montant = readAmount(req.body.montant, errors); // Montant positif.
  const source = String(req.body.source || "").trim(); // Origine de l'argent.
  const date = readDate(req.body.date, errors); // Date année-mois-jour.
  const description = String(req.body.description || "").trim(); // Texte libre, peut être vide.
  let categoryId = req.body.categorie ? Number(req.body.categorie) : null; // Catégorie facultative.
  if (!source) errors.push("La source du revenu est obligatoire."); // La source ne peut pas être vide.
  if (categoryId) { // Seulement si une catégorie est choisie.
    const category = categories.findVisible(categoryId, userId); // Elle doit être visible par ce compte.
    if (!category || category.type_categorie !== "revenu") errors.push("La catégorie choisie n'est pas un revenu."); // Refuse une catégorie de dépense ou inconnue.
  } // Fin du contrôle de catégorie.
  return { errors, row: { montant, source, description, date, categoryId } }; // La liste d'erreurs et la ligne prête, même si des erreurs existent. L'appelant décide.
} // Fin de la vérification d'un revenu.

function parseExpense(req, userId) { // Vérifie le formulaire d'une dépense.
  const errors = []; // Messages d'erreur.
  const montant = readAmount(req.body.montant, errors); // Montant positif.
  const date = readDate(req.body.date, errors); // Date.
  const moyenPaiement = String(req.body.moyen_paiement || "").trim(); // Espèces, carte, etc.
  const description = String(req.body.description || "").trim(); // Texte libre.
  const categoryId = Number(req.body.categorie); // Numéro de catégorie. Obligatoire : Number("") vaut 0, qui ne sera pas trouvé.
  const category = categories.findVisible(categoryId, userId); // Catégorie visible par ce compte.
  if (!category || category.type_categorie !== "depense") errors.push("Chaque dépense doit être associée à une catégorie de dépense."); // Refuse l'absence de catégorie ou une catégorie de revenu.
  if (!moyenPaiement) errors.push("Le moyen de paiement est obligatoire."); // Le moyen de paiement ne peut pas être vide.
  return { errors, row: { montant, date, moyenPaiement, description, categoryId } }; // Erreurs et ligne prête.
} // Fin de la vérification d'une dépense.

function readAmount(raw, errors) { // Lit un montant et ajoute le message de Money dans la liste si besoin.
  const parsed = Money.parse(raw); // ok, value, ou ok false et error.
  if (!parsed.ok) errors.push(parsed.error); // On empile le message, on ne s'arrête pas tout de suite : d'autres contrôles suivent.
  return parsed.value; // Le nombre, ou undefined si le montant était refusé.
} // Fin de la lecture d'un montant.

function readDate(raw, errors, label = "La date") { // Lit une date. label personnalise le début du message, par exemple « La date de début ».
  const value = String(raw || "").trim(); // Texte sans espaces.
  if (!Period.isIsoDate(value)) errors.push(`${label} est invalide.`); // Refuse si ce n'est pas une vraie date année-mois-jour.
  return value; // On renvoie le texte même s'il est invalide. Les erreurs sont dans la liste.
} // Fin de la lecture d'une date.

const port = Number(process.env.PORT || 3000); // Port d'écoute : la variable d'environnement PORT, sinon 3000.
app.listen(port, () => { // Démarre le serveur. La fonction est appelée quand il écoute vraiment.
  console.log(`Node.js ${process.version} — application sur http://localhost:${port}`); // Affiche la version de Node et l'adresse locale dans le terminal.
}); // Fin du démarrage. Le processus reste ouvert pour répondre aux demandes.
