import path from "node:path"; // Outil pour coller des morceaux de chemin de fichier.
import express from "express"; // Bibliothèque qui reçoit les requêtes du navigateur et y répond.
import session from "express-session"; // Bibliothèque qui retient qui est connecté d'une page à l'autre.
import { AppDatabase } from "./db/Database.js"; // Ouvre la base SQLite et crée les tables.
import { PasswordHasher } from "./security/PasswordHasher.js"; // Transforme un mot de passe en empreinte illisible.
import { UserRepository } from "./models/repositories/UserRepository.js"; // Lecture et écriture des comptes.
import { CategoryRepository } from "./models/repositories/CategoryRepository.js"; // Lecture et écriture des catégories.
import { IncomeRepository } from "./models/repositories/IncomeRepository.js"; // Lecture et écriture des revenus.
import { ExpenseRepository } from "./models/repositories/ExpenseRepository.js"; // Lecture et écriture des dépenses.
import { BudgetRepository } from "./models/repositories/BudgetRepository.js"; // Lecture et écriture des budgets.
import { NotificationRepository } from "./models/repositories/NotificationRepository.js"; // Lecture et écriture des messages d'alerte.
import { FinanceService } from "./models/FinanceService.js"; // Calculs de solde, d'état de budget et d'alertes.
import { AppView } from "./views/AppView.js"; // Cadre des pages : menu, en-tête, page publique.
import { // Vues : chacune fabrique le HTML du milieu d'une page.
  AuthView, // Pages d'accueil, d'inscription et de connexion.
  BudgetView, // Page des budgets.
  CategoryView, // Page des catégories.
  DashboardView, // Tableau de bord.
  HistoryView, // Historique des opérations.
  NotificationView, // Liste des notifications.
  OperationView, // Liste et formulaire partagés par revenus et dépenses.
  ProfileView, // Page du profil.
  StatsView, // Page des statistiques.
} from "./views/pages.js"; // Toutes ces vues fabriquent le HTML du milieu de la page.
import { AuthPresenter, ProfilePresenter } from "./presenters/AuthPresenter.js"; // Logique compte : connexion, inscription, profil.
import { DashboardPresenter, HistoryPresenter, NotificationPresenter, StatsPresenter } from "./presenters/ReportPresenters.js"; // Logique des pages de lecture : tableau de bord, historique, alertes, stats.
import { ExpensePresenter, IncomePresenter } from "./presenters/OperationPresenters.js"; // Logique d'ajout, modification et suppression des opérations.
import { BudgetPresenter, CategoryPresenter } from "./presenters/CatalogPresenters.js"; // Logique des catégories et des budgets.

export function createApp(dbPath) { // Construit l'application. dbPath est le fichier SQLite à ouvrir.
  const database = new AppDatabase(dbPath); // Ouvre (ou crée) la base et ses tables.
  const db = database.db; // Connexion brute, passée aux dépôts.
  const users = new UserRepository(db); // Dépôt des comptes.
  const categories = new CategoryRepository(db); // Dépôt des catégories.
  const incomes = new IncomeRepository(db); // Dépôt des revenus.
  const expenses = new ExpenseRepository(db); // Dépôt des dépenses.
  const budgets = new BudgetRepository(db); // Dépôt des budgets.
  const notifications = new NotificationRepository(db); // Dépôt des notifications.
  const finance = new FinanceService({ incomes, expenses, budgets, notifications }); // Service de calculs, branché sur ces dépôts.
  const passwords = new PasswordHasher(); // Outil de mots de passe.
  const layout = new AppView(); // Un seul cadre de page pour toute l'application.

  const auth = new AuthPresenter({ users, passwords, view: new AuthView(), layout }); // Présentateur connexion / inscription.
  const profile = new ProfilePresenter({ users, passwords, view: new ProfileView(), layout, notifications }); // Présentateur du profil.
  const dashboard = new DashboardPresenter({ finance, expenses, incomes, budgets, notifications, view: new DashboardView(), layout }); // Présentateur du tableau de bord.
  const incomePresenter = new IncomePresenter({ incomes, categories, finance, notifications, view: new OperationView(), layout }); // Présentateur des revenus.
  const expensePresenter = new ExpensePresenter({ expenses, categories, finance, notifications, view: new OperationView(), layout }); // Présentateur des dépenses.
  const categoryPresenter = new CategoryPresenter({ categories, notifications, view: new CategoryView(), layout }); // Présentateur des catégories.
  const budgetPresenter = new BudgetPresenter({ budgets, categories, finance, notifications, view: new BudgetView(), layout }); // Présentateur des budgets.
  const history = new HistoryPresenter({ incomes, expenses, categories, notifications, view: new HistoryView(), layout }); // Présentateur de l'historique.
  const stats = new StatsPresenter({ finance, expenses, notifications, view: new StatsView(), layout }); // Présentateur des statistiques.
  const notificationPresenter = new NotificationPresenter({ notifications, view: new NotificationView(), layout }); // Présentateur des notifications.

  const app = express(); // Application web vide, on va y ajouter les règles.
  app.use(express.urlencoded({ extended: false })); // Lit les formulaires HTML classiques (pas le JSON).
  app.use(express.static(path.join(import.meta.dirname, "../public"))); // Sert les fichiers du dossier public (CSS, JS des graphiques).
  app.use(session({ // Active la mémoire de connexion.
    secret: process.env.SESSION_SECRET || "depenses-tp-mri", // Texte secret pour signer le cookie. Variable d'environnement, sinon une valeur de travail.
    resave: false, // N'écrit pas la session à chaque requête si rien n'a changé.
    saveUninitialized: false, // Ne crée pas de session tant que personne ne s'est connecté.
    cookie: { httpOnly: true, sameSite: "lax" }, // Le cookie n'est pas lisible par le JavaScript de la page, et il n'est pas envoyé depuis un autre site.
  })); // Fin du réglage de session.

  const send = (handler, { authRequired = false, takeNotice = true } = {}) => async (req, res, next) => { // Enveloppe commune : handler fait le travail, les options disent si la connexion est obligatoire.
    try { // On attrape les erreurs pour ne pas faire planter le serveur.
      if (authRequired && !req.session.user) return res.redirect("/connexion"); // Page privée sans compte : on renvoie vers la connexion.
      const notice = takeNotice ? req.session.flash || "" : ""; // Message flash à afficher une fois, ou chaîne vide.
      if (takeNotice) delete req.session.flash; // On efface le message pour ne pas le revoir au prochain chargement.
      const result = await handler({ // Appelle la fonction de la page avec un résumé de la requête.
        session: req.session, // Mémoire de connexion, pour y écrire le compte ou un message.
        user: req.session.user, // Compte connecté, ou rien.
        body: req.body || {}, // Champs du formulaire envoyé.
        query: req.query || {}, // Paramètres après le ? dans l'adresse.
        params: req.params || {}, // Morceaux variables de l'adresse, comme un numéro d'id.
        notice, // Message à afficher en haut de la page.
      }); // Fin de l'appel.
      if (result.type === "redirect") return res.redirect(result.location); // La page demande un changement d'adresse.
      res.status(result.status).type("html").send(result.body); // Sinon on envoie le HTML avec le code de statut prévu.
    } catch (error) { // Une exception s'est produite.
      next(error); // On la passe au gestionnaire d'erreur tout en bas.
    } // Fin du try.
  }; // Fin de send.

  app.get("/", send((ctx) => (ctx.user ? dashboard.show(ctx) : auth.home(ctx)))); // Adresse / : tableau de bord si connecté, sinon page d'accueil publique.
  app.get("/inscription", send((ctx) => auth.registerForm(ctx))); // Affiche le formulaire d'inscription.
  app.post("/inscription", send((ctx) => auth.register(ctx), { takeNotice: false })); // Enregistre le nouveau compte. On ne consomme pas le message flash ici.
  app.get("/connexion", send((ctx) => auth.loginForm(ctx))); // Affiche le formulaire de connexion.
  app.post("/connexion", send((ctx) => auth.login(ctx), { takeNotice: false })); // Vérifie l'e-mail et le mot de passe.
  app.post("/deconnexion", send((ctx) => auth.logout(ctx), { authRequired: true, takeNotice: false })); // Efface la session. Il faut être connecté.

  app.get("/tableau-de-bord", send((ctx) => dashboard.show(ctx), { authRequired: true })); // Tableau de bord, page privée.
  app.get("/revenus", send((ctx) => incomePresenter.show(ctx), { authRequired: true })); // Liste des revenus.
  app.post("/revenus", send((ctx) => incomePresenter.create(ctx), { authRequired: true, takeNotice: false })); // Crée un revenu.
  app.get("/revenus/:id", send((ctx) => incomePresenter.editForm(ctx), { authRequired: true })); // Formulaire pour modifier le revenu dont le numéro est dans l'adresse.
  app.post("/revenus/:id", send((ctx) => incomePresenter.update(ctx), { authRequired: true, takeNotice: false })); // Enregistre la modification.
  app.post("/revenus/:id/supprimer", send((ctx) => incomePresenter.remove(ctx), { authRequired: true, takeNotice: false })); // Supprime ce revenu.

  app.get("/depenses", send((ctx) => expensePresenter.show(ctx), { authRequired: true })); // Liste des dépenses, avec filtres.
  app.post("/depenses", send((ctx) => expensePresenter.create(ctx), { authRequired: true, takeNotice: false })); // Crée une dépense.
  app.get("/depenses/:id", send((ctx) => expensePresenter.editForm(ctx), { authRequired: true })); // Formulaire de modification d'une dépense.
  app.post("/depenses/:id", send((ctx) => expensePresenter.update(ctx), { authRequired: true, takeNotice: false })); // Enregistre la modification.
  app.post("/depenses/:id/supprimer", send((ctx) => expensePresenter.remove(ctx), { authRequired: true, takeNotice: false })); // Supprime cette dépense.

  app.get("/categories", send((ctx) => categoryPresenter.show(ctx), { authRequired: true })); // Liste des catégories.
  app.post("/categories", send((ctx) => categoryPresenter.create(ctx), { authRequired: true, takeNotice: false })); // Crée une catégorie.
  app.post("/categories/:id", send((ctx) => categoryPresenter.rename(ctx), { authRequired: true, takeNotice: false })); // Renomme une catégorie personnelle.
  app.post("/categories/:id/supprimer", send((ctx) => categoryPresenter.remove(ctx), { authRequired: true, takeNotice: false })); // Supprime une catégorie personnelle non utilisée.

  app.get("/budgets", send((ctx) => budgetPresenter.show(ctx), { authRequired: true })); // Liste des budgets.
  app.post("/budgets", send((ctx) => budgetPresenter.create(ctx), { authRequired: true, takeNotice: false })); // Crée un budget.
  app.post("/budgets/:id/supprimer", send((ctx) => budgetPresenter.remove(ctx), { authRequired: true, takeNotice: false })); // Supprime un budget.

  app.get("/historique", send((ctx) => history.show(ctx), { authRequired: true })); // Historique filtré.
  app.get("/statistiques", send((ctx) => stats.show(ctx), { authRequired: true })); // Graphiques et totaux du mois.
  app.get("/notifications", send((ctx) => notificationPresenter.show(ctx), { authRequired: true })); // Liste des alertes, puis elles sont marquées lues.
  app.get("/profil", send((ctx) => profile.show(ctx), { authRequired: true })); // Page profil.
  app.post("/profil", send((ctx) => profile.update(ctx), { authRequired: true, takeNotice: false })); // Met à jour nom, prénom et e-mail.
  app.post("/profil/mot-de-passe", send((ctx) => profile.password(ctx), { authRequired: true, takeNotice: false })); // Change le mot de passe.

  app.use((error, req, res, next) => { // Dernier recours : toute erreur non gérée arrive ici. next est exigé par Express pour reconnaître un gestionnaire d'erreur.
    console.error(error); // Écrit l'erreur dans la console du serveur, pas dans la page.
    res.status(500).type("html").send("<h1>Erreur interne</h1><p>L'opération n'a pas pu aboutir.</p>"); // Répond 500 avec un message simple, sans détail technique.
  }); // Fin du gestionnaire d'erreur.

  return app; // Renvoie l'application prête à écouter un port.
} // Fin de createApp.
