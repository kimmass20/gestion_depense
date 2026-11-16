import { html, redirect, clean } from "./form.js"; // html : réponse page. redirect : changement d'adresse. clean : enlève les espaces autour d'un texte.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Forme minimale d'un e-mail : du texte, un @, du texte, un point, du texte. Pas d'espace.

export class AuthPresenter { // Accueil public, inscription, connexion et déconnexion.
  constructor({ users, passwords, view, layout }) { // Reçoit les outils dont cette classe a besoin.
    this.users = users; // Accès à la table des comptes.
    this.passwords = passwords; // Outil qui transforme et vérifie les mots de passe.
    this.view = view; // Morceaux de page : accueil, inscription, connexion.
    this.layout = layout; // Cadre des pages publiques, sans menu.
  } // Fin du constructeur.

  home(ctx) { // Page d'accueil pour une personne qui n'est pas dans l'espace connecté.
    if (ctx.user) return redirect("/"); // Déjà connecté : on envoie vers l'accueil privé.
    return html(this.layout.renderPublic("Accueil", this.view.home(), ctx.notice)); // Sinon la page publique avec les deux boutons.
  } // Fin de home.

  registerForm(ctx) { // Affiche le formulaire de création de compte, encore vide.
    if (ctx.user) return redirect("/"); // Déjà connecté : pas besoin d'un nouveau compte.
    return html(this.layout.renderPublic("Inscription", this.view.register(), ctx.notice)); // Formulaire d'inscription.
  } // Fin de registerForm.

  register(ctx) { // Traite le formulaire envoyé et crée le compte s'il est valable.
    const values = { // Textes nettoyés, pour les réafficher si une erreur arrive.
      nom: clean(ctx.body.nom), // Nom, sans espaces inutiles.
      prenom: clean(ctx.body.prenom), // Prénom, nettoyé de la même façon.
      email: clean(ctx.body.email).toLowerCase(), // E-mail en minuscules, pour comparer sans tenir compte des majuscules.
    }; // Fin des textes.
    const password = String(ctx.body.mot_de_passe ?? ""); // Mot de passe tapé. Chaîne vide si le champ est absent.
    const errors = []; // Messages à montrer si quelque chose est faux.
    if (!values.nom || !values.prenom) errors.push("Le nom et le prénom sont obligatoires."); // Les deux champs doivent contenir quelque chose.
    if (!EMAIL.test(values.email)) errors.push("L'adresse e-mail est invalide."); // L'e-mail doit ressembler à nom@domaine.xx.
    if (password.length < 8) errors.push("Le mot de passe doit contenir au moins 8 caractères."); // Longueur minimale.
    if (password !== String(ctx.body.confirmation ?? "")) errors.push("La confirmation du mot de passe ne correspond pas."); // Les deux saisies doivent être identiques.
    if (!errors.length && this.users.findByEmail(values.email)) errors.push("Un compte existe déjà avec cet e-mail."); // On cherche un doublon seulement s'il n'y a pas déjà une autre erreur.
    if (errors.length) { // Au moins une erreur : on ne crée pas le compte.
      return html(this.layout.renderPublic("Inscription", this.view.register(errors, values), ctx.notice), 422); // Code 422 : les données envoyées ne sont pas acceptables. On réaffiche le formulaire.
    } // Fin du cas d'erreur.
    const id = this.users.insert({ // Enregistre le compte et récupère son numéro.
      ...values, // Nom, prénom, e-mail.
      motDePasse: this.passwords.hash(password), // On stocke une empreinte, pas le mot de passe en clair.
      dateCreation: new Date().toISOString(), // Date et heure de création.
    }); // Fin des données enregistrées.
    const user = this.users.findById(id); // Relit le compte tout juste créé.
    ctx.session.user = publicUser(user); // Mémorise la personne connectée, sans le mot de passe.
    ctx.session.flash = "Compte créé. Bienvenue."; // Message affiché une seule fois sur la page suivante.
    return redirect("/"); // Renvoie vers la page d'accueil.
  } // Fin de register.

  loginForm(ctx) { // Affiche le formulaire de connexion.
    if (ctx.user) return redirect("/"); // Déjà connecté : on ne redemande pas le mot de passe.
    return html(this.layout.renderPublic("Connexion", this.view.login(), ctx.notice)); // Formulaire de connexion.
  } // Fin de loginForm.

  login(ctx) { // Vérifie l'e-mail et le mot de passe envoyés.
    const email = clean(ctx.body.email).toLowerCase(); // E-mail nettoyé et en minuscules.
    const user = this.users.findByEmail(email); // Cherche le compte. Il peut ne pas exister.
    const password = String(ctx.body.mot_de_passe ?? ""); // Mot de passe tapé, ou chaîne vide.
    if (!user || !this.passwords.verify(password, user.mot_de_passe)) { // Compte inconnu ou mot de passe faux. On ne dit pas lequel.
      return html(this.layout.renderPublic("Connexion", this.view.login(["E-mail ou mot de passe incorrect."], email), ctx.notice), 401); // Code 401 : accès refusé. On garde l'e-mail tapé.
    } // Fin du refus.
    ctx.session.user = publicUser(user); // Connexion réussie : compte sans mot de passe.
    ctx.session.flash = "Connexion réussie."; // Confirmation pour la page suivante.
    return redirect("/"); // Vers l'accueil.
  } // Fin de login.

  logout(ctx) { // Déconnexion.
    return new Promise((resolve) => { // La destruction de la session finit plus tard : on attend avec une promesse.
      ctx.session.destroy(() => resolve(redirect("/connexion"))); // Efface la session, puis envoie vers la page de connexion.
    }); // Fin de la promesse.
  } // Fin de logout.
} // Fin de AuthPresenter.

export class ProfilePresenter { // Page profil : nom, e-mail, et changement de mot de passe.
  constructor({ users, passwords, view, layout, notifications }) { // Outils nécessaires.
    this.users = users; // Table des comptes.
    this.passwords = passwords; // Vérification et empreinte des mots de passe.
    this.view = view; // Les deux formulaires de la page.
    this.layout = layout; // Cadre avec le menu, pour une page privée.
    this.notifications = notifications; // Pour le nombre de messages non lus dans le menu.
  } // Fin du constructeur.

  show(ctx, extra = {}) { // Affiche la page. extra contient les erreurs des formulaires, s'il y en a.
    const user = this.users.findById(ctx.user.id); // Relit le compte à jour dans la base.
    return html(this.layout.renderPrivate({ // Page avec le menu.
      title: "Profil", // Titre de l'onglet et du fil en haut.
      user, // Compte affiché dans le menu.
      unread: this.notifications.unreadCount(user.id_utilisateur), // Nombre de notifications non lues.
      notice: ctx.notice, // Message flash, s'il y en a un.
      content: this.view.render({ // Contenu : formulaire profil et formulaire mot de passe.
        user, // Valeurs déjà enregistrées.
        profileErrors: extra.profileErrors, // Erreurs du nom, du prénom ou de l'e-mail.
        passwordErrors: extra.passwordErrors, // Erreurs du changement de mot de passe.
      }), // Fin du contenu.
    })); // Fin de la page. Code 200 par défaut.
  } // Fin de show.

  update(ctx) { // Enregistre le nouveau nom, prénom et e-mail.
    const nom = clean(ctx.body.nom); // Nom nettoyé.
    const prenom = clean(ctx.body.prenom); // Prénom nettoyé.
    const email = clean(ctx.body.email).toLowerCase(); // E-mail nettoyé, en minuscules.
    const errors = []; // Messages d'erreur.
    if (!nom || !prenom) errors.push("Le nom et le prénom sont obligatoires."); // Les deux champs sont requis.
    if (!EMAIL.test(email)) errors.push("L'adresse e-mail est invalide."); // Forme de l'e-mail.
    const existing = this.users.findByEmail(email); // Un compte a-t-il déjà cet e-mail ?
    if (existing && existing.id_utilisateur !== ctx.user.id) errors.push("Cet e-mail est déjà utilisé."); // On autorise de garder son propre e-mail.
    if (errors.length) return this.show({ ...ctx, notice: "" }, { profileErrors: errors }); // Réaffiche le formulaire avec les erreurs, sans message flash.
    this.users.updateProfile(ctx.user.id, { nom, prenom, email }); // Écrit les nouvelles valeurs.
    ctx.session.user = publicUser(this.users.findById(ctx.user.id)); // Met à jour le nom affiché dans le menu.
    ctx.session.flash = "Profil mis à jour."; // Confirmation pour la page suivante.
    return redirect("/profil"); // Recharge la page profil.
  } // Fin de update.

  password(ctx) { // Change le mot de passe.
    const user = this.users.findById(ctx.user.id); // Relit le compte, y compris l'empreinte actuelle.
    const errors = []; // Messages d'erreur.
    if (!this.passwords.verify(String(ctx.body.actuel ?? ""), user.mot_de_passe)) { // L'ancien mot de passe doit être le bon.
      errors.push("Le mot de passe actuel est incorrect."); // Sinon on refuse le changement.
    } // Fin de la vérification de l'ancien mot de passe.
    const next = String(ctx.body.nouveau ?? ""); // Nouveau mot de passe tapé.
    if (next.length < 8) errors.push("Le nouveau mot de passe doit contenir au moins 8 caractères."); // Longueur minimale.
    if (next !== String(ctx.body.confirmation ?? "")) errors.push("La confirmation ne correspond pas."); // Les deux saisies doivent être égales.
    if (errors.length) return this.show({ ...ctx, notice: "" }, { passwordErrors: errors }); // Réaffiche avec les erreurs.
    this.users.updatePassword(user.id_utilisateur, this.passwords.hash(next)); // Enregistre la nouvelle empreinte, pas le mot en clair.
    ctx.session.flash = "Mot de passe modifié."; // Confirmation.
    return redirect("/profil"); // Retour à la page profil.
  } // Fin de password.
} // Fin de ProfilePresenter.

// Seule cette fonction est utilisée par le serveur actuel (serveur/index.js).
// Le reste de ce fichier appartient à l'ancienne version et n'est pas lancé.
// publicUser prépare ce qu'on a le droit d'envoyer au navigateur : jamais le mot de passe.
export function publicUser(user) { // user est la ligne complète lue dans la table des comptes.
  return { // On construit un objet réduit.
    id: user.id_utilisateur, // Numéro du compte.
    nom: user.nom, // Nom de famille.
    prenom: user.prenom, // Prénom.
    email: user.email, // Adresse e-mail.
  }; // Fin de l'objet renvoyé. mot_de_passe et date_creation ne sont pas copiés.
} // Fin de publicUser.
