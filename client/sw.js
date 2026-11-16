const SHELL = "depenses-shell-v4"; // Nom du casier qui garde les fichiers de la page. Changer ce nom force le navigateur à reprendre une copie neuve.
const PDFS = "depenses-pdf-v1"; // Nom d'un second casier, réservé aux fichiers PDF.
const APP_FILES = ["/", "/index.html", "/css/style.css", "/js/app.js", "/js/stockage.js", "/js/mesures.js", "/manifest.webmanifest"]; // Fichiers copiés dès l'installation pour que la coque de l'application reste disponible hors ligne.

// Ce fichier est un service worker : un petit programme du navigateur, à côté de la page.
// Il intercepte certaines demandes de fichiers et peut répondre avec une copie gardée.
self.addEventListener("install", (event) => { // « install » : le navigateur vient d'enregistrer ce programme.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting())); // On attend la fin : ouvrir le casier, y copier les fichiers de la page, puis activer cette version tout de suite sans attendre la fermeture des anciens onglets.
}); // Fin de l'installation.

self.addEventListener("activate", (event) => { // « activate » : cette version devient celle qui travaille.
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== PDFS).map((key) => caches.delete(key)))).then(() => self.clients.claim())); // On liste les casiers, on efface ceux qui ne sont ni le casier de la page ni celui des PDF, puis on prend le contrôle des onglets déjà ouverts.
}); // Fin de l'activation.

self.addEventListener("fetch", (event) => { // « fetch » : la page demande un fichier ou une adresse. event.request est cette demande.
  const url = new URL(event.request.url); // On décompose l'adresse demandée (site, chemin, etc.).
  if (url.origin !== self.location.origin) return; // Si l'adresse est un autre site (polices, graphique), on ne s'en mêle pas.
  if (url.pathname.startsWith("/api/")) return; // Les adresses /api/ parlent au serveur : pas de copie hors ligne ici, le serveur doit répondre.

  if (url.pathname.endsWith(".pdf")) { // Un fichier dont le nom finit par .pdf.
    event.respondWith(cacheFirst(event.request, PDFS)); // On répond d'abord avec la copie gardée, sinon on va le chercher sur le réseau.
    return; // On s'arrête là pour cette demande.
  } // Fin du cas PDF.

  if (event.request.mode === "navigate" || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) { // Ouverture d'une page, ou fichier de style, ou fichier JavaScript.
    event.respondWith(networkFirst(event.request)); // On essaie d'abord le réseau pour avoir la version fraîche, et la copie seulement si le réseau échoue.
    return; // On s'arrête là pour cette demande.
  } // Fin du cas page / style / script.

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); // Pour le reste : copie gardée si elle existe, sinon demande normale au réseau.
}); // Fin de l'interception des demandes.

async function networkFirst(request) { // async : cette fonction peut attendre. Stratégie « réseau d'abord ».
  const cache = await caches.open(SHELL); // On ouvre le casier des fichiers de la page. await attend que ce soit prêt.
  try { // On tente le réseau. try/catch attrape l'échec (par exemple pas d'internet).
    const response = await fetch(request); // Demande réelle au serveur.
    if (response.ok) cache.put(request, response.clone()); // Si la réponse est réussie, on en garde une copie. clone() est obligatoire : une réponse ne se lit qu'une fois.
    return response; // On renvoie la réponse du réseau à la page.
  } catch { // Le réseau a échoué.
    return (await cache.match(request)) || (await cache.match("/index.html")); // On renvoie la copie de ce fichier, ou au moins la page d'accueil gardée.
  } // Fin du cas hors réseau.
} // Fin de « réseau d'abord ».

async function cacheFirst(request, cacheName) { // Stratégie « copie d'abord ». cacheName dit quel casier utiliser.
  const cache = await caches.open(cacheName); // Ouvre le casier demandé.
  const cached = await cache.match(request); // Cherche une copie de cette demande.
  if (cached) return cached; // Si elle existe, on la renvoie tout de suite, sans réseau.
  const response = await fetch(request); // Sinon on télécharge le fichier.
  if (response.ok) cache.put(request, response.clone()); // Réponse réussie : on la range pour la prochaine fois.
  return response; // On renvoie le fichier téléchargé.
} // Fin de « copie d'abord ».
