const charts = []; // Liste des graphiques créés. On la garde pour que les objets ne soient pas oubliés tout de suite.

function series(id) { // Lit les données cachées dans une balise script dont l'id est donné.
  const node = document.getElementById(id); // Cherche la balise. Elle peut ne pas exister sur cette page.
  if (!node) return null; // Pas de données : on ne dessine pas ce graphique.
  return JSON.parse(node.textContent); // Le texte de la balise est du JSON : on le transforme en objet.
} // Fin de series.

function baseOptions(legend) { // Réglages communs des graphiques. legend dit si on affiche la légende.
  return { // Objet de réglages compris par Chart.js.
    responsive: true, // Le graphique suit la largeur de son cadre.
    maintainAspectRatio: false, // On laisse le cadre CSS décider de la hauteur.
    plugins: { // Réglages des modules de Chart.js.
      legend: { display: legend, labels: { boxWidth: 12, usePointStyle: true } }, // Légende visible ou non. Petits points plutôt que des carrés larges.
    }, // Fin des modules.
    scales: { // Axes.
      y: { beginAtZero: true, grid: { color: "#e5e7eb" }, ticks: { color: "#6b7280" } }, // Axe vertical : part de zéro, traits gris clair, nombres gris.
      x: { grid: { display: false }, ticks: { color: "#6b7280" } }, // Axe horizontal : pas de traits verticaux, libellés gris.
    }, // Fin des axes.
  }; // Fin des réglages.
} // Fin de baseOptions.

const spend = series("spend-series"); // Données de la courbe des dépenses, ou null si la page n'en a pas.
if (spend && document.getElementById("spend-chart")) { // On dessine seulement si les données et la zone canvas existent.
  charts.push(new Chart(document.getElementById("spend-chart"), { // Chart est fourni par la bibliothèque chargée dans la page. On mémorise le graphique.
    type: "line", // Courbe.
    data: { // Données dessinées.
      labels: spend.labels, // Noms des mois, sous la courbe.
      datasets: [{ // Une seule série.
        label: "Dépenses", // Nom de la série.
        data: spend.values, // Montants, dans le même ordre que les noms.
        borderColor: "#1d4ed8", // Couleur du trait, bleu.
        backgroundColor: "rgba(29, 78, 216, 0.12)", // Remplissage bleu très transparent sous la courbe.
        fill: true, // On remplit sous la courbe.
        tension: 0.35, // Courbe un peu arrondie, pas des segments cassés.
        pointRadius: 3, // Petits points sur chaque mois.
      }], // Fin de la série.
    }, // Fin des données.
    options: baseOptions(false), // Réglages communs, sans légende : il n'y a qu'une série.
  })); // Fin de la création du graphique.
} // Fin de la courbe des dépenses.

const compare = series("compare-series"); // Données des barres revenus / dépenses, ou null.
if (compare && document.getElementById("compare-chart")) { // Données et zone présentes.
  charts.push(new Chart(document.getElementById("compare-chart"), { // Graphique en barres.
    type: "bar", // Barres.
    data: { // Données.
      labels: compare.labels, // Noms des mois.
      datasets: [ // Deux séries côte à côte.
        { label: "Revenus", data: compare.revenus, backgroundColor: "#047857", borderRadius: 6 }, // Barres vertes, coins arrondis.
        { label: "Dépenses", data: compare.depenses, backgroundColor: "#b91c1c", borderRadius: 6 }, // Barres rouges, coins arrondis.
      ], // Fin des séries.
    }, // Fin des données.
    options: baseOptions(true), // Réglages communs, avec légende pour distinguer les deux couleurs.
  })); // Fin du graphique.
} // Fin des barres.

const categories = series("category-series"); // Données du camembert des catégories, ou null.
if (categories && document.getElementById("category-chart") && categories.labels.length) { // On dessine seulement s'il y a au moins une catégorie.
  charts.push(new Chart(document.getElementById("category-chart"), { // Camembert.
    type: "doughnut", // Anneau (camembert avec un trou au centre).
    data: { // Données.
      labels: categories.labels, // Noms des catégories.
      datasets: [{ // Une série de parts.
        data: categories.values, // Montants, même ordre que les noms.
        backgroundColor: ["#1d4ed8", "#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe", "#6b7280", "#9ca3af"], // Sept bleus puis gris. Chart.js les réutilise s'il y a plus de parts.
      }], // Fin de la série.
    }, // Fin des données.
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }, // Suit le cadre. Légende en bas, pas d'axes : un camembert n'en a pas.
  })); // Fin du camembert.
} // Fin du camembert.
