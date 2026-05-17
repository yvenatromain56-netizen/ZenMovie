// --- FIREBASE CONFIG ---
// Tu dois créer un projet Firebase gratuit et coller ta config ici.
// Voir les instructions en bas de ce fichier.

const FIREBASE_CONFIG = {
    apiKey: localStorage.getItem("zenmovie-firebase-apikey") || "",
    authDomain: localStorage.getItem("zenmovie-firebase-domain") || "",
    databaseURL: localStorage.getItem("zenmovie-firebase-dburl") || "",
    projectId: localStorage.getItem("zenmovie-firebase-project") || ""
};

let firebaseApp = null;
let db = null;
let currentRoom = null;
let playerId = localStorage.getItem("zenmovie-player-id");

if (!playerId) {
    playerId = "player_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("zenmovie-player-id", playerId);
}

function isFirebaseConfigured() {
    return FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.databaseURL.length > 10;
}

function initFirebase() {
    if (firebaseApp) return true;
    if (!isFirebaseConfigured()) {
        showFirebaseSetup();
        return false;
    }
    try {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.database();
        return true;
    } catch (e) {
        console.error("Firebase init error:", e);
        return false;
    }
}

function showFirebaseSetup() {
    const dbUrl = prompt(
        "Mode Couple : configuration Firebase requise (une seule fois).\n\n" +
        "1. Va sur console.firebase.google.com\n" +
        "2. Crée un projet (gratuit)\n" +
        "3. Active 'Realtime Database' (mode test)\n" +
        "4. Va dans Paramètres > Général\n" +
        "5. Copie le 'databaseURL' (ex: https://monprojet-default-rtdb.firebaseio.com)\n\n" +
        "Colle le databaseURL ici :"
    );

    if (dbUrl && dbUrl.includes("firebaseio.com")) {
        const projectId = dbUrl.split("//")[1]?.split("-default")[0] || "zenmovie";
        localStorage.setItem("zenmovie-firebase-dburl", dbUrl.trim());
        localStorage.setItem("zenmovie-firebase-domain", projectId + ".firebaseapp.com");
        localStorage.setItem("zenmovie-firebase-project", projectId);
        localStorage.setItem("zenmovie-firebase-apikey", "AIza-placeholder");

        FIREBASE_CONFIG.databaseURL = dbUrl.trim();
        FIREBASE_CONFIG.authDomain = projectId + ".firebaseapp.com";
        FIREBASE_CONFIG.projectId = projectId;
        FIREBASE_CONFIG.apiKey = "AIza-placeholder";

        initFirebase();
    }
}

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function createRoom() {
    if (!initFirebase()) return;

    const code = generateRoomCode();
    const roomRef = db.ref("rooms/" + code);

    await roomRef.set({
        created: Date.now(),
        players: { [playerId]: true }
    });

    joinRoomListeners(code);
    showActiveRoom(code);
}

async function joinRoom(code) {
    if (!initFirebase()) return;
    if (!code || code.length !== 4) {
        alert("Entre un code à 4 chiffres.");
        return;
    }

    const roomRef = db.ref("rooms/" + code);
    const snapshot = await roomRef.once("value");

    if (!snapshot.exists()) {
        alert("Room introuvable. Vérifie le code.");
        return;
    }

    await roomRef.child("players/" + playerId).set(true);
    joinRoomListeners(code);
    showActiveRoom(code);
}

function joinRoomListeners(code) {
    currentRoom = code;
    localStorage.setItem("zenmovie-room", code);

    const coupleStatus = document.getElementById("couple-status");
    coupleStatus.textContent = "Room " + code;
    coupleStatus.classList.remove("hidden");

    // Listen for other player's likes to detect mutual matches
    const likesRef = db.ref("rooms/" + code + "/likes");
    likesRef.on("child_added", (snapshot) => {
        const movieKey = snapshot.key;
        const likedBy = snapshot.val();

        // If both players liked the same movie
        if (likedBy && typeof likedBy === "object") {
            const players = Object.keys(likedBy);
            if (players.length >= 2 && players.includes(playerId)) {
                // Mutual match! Find the movie info
                const movieTitle = movieKey.replace(/_/g, " ");
                showCoupleMatch(movieTitle);
            }
        }
    });

    likesRef.on("child_changed", (snapshot) => {
        const movieKey = snapshot.key;
        const likedBy = snapshot.val();

        if (likedBy && typeof likedBy === "object") {
            const players = Object.keys(likedBy);
            if (players.length >= 2 && players.includes(playerId)) {
                const movieTitle = movieKey.replace(/_/g, " ");
                showCoupleMatch(movieTitle);
            }
        }
    });

    // Listen for player count
    const playersRef = db.ref("rooms/" + code + "/players");
    playersRef.on("value", (snapshot) => {
        const players = snapshot.val();
        const count = players ? Object.keys(players).length : 0;
        const playersEl = document.getElementById("couple-players");
        if (playersEl) {
            playersEl.textContent = count + " joueur" + (count > 1 ? "s" : "") + " connecté" + (count > 1 ? "s" : "");
        }
    });
}

function showActiveRoom(code) {
    document.getElementById("couple-menu").classList.add("hidden");
    document.getElementById("couple-active").classList.remove("hidden");
    document.getElementById("couple-room-code").textContent = code;
}

function leaveRoom() {
    if (currentRoom && db) {
        db.ref("rooms/" + currentRoom + "/players/" + playerId).remove();
        db.ref("rooms/" + currentRoom + "/likes").off();
        db.ref("rooms/" + currentRoom + "/players").off();
    }
    currentRoom = null;
    localStorage.removeItem("zenmovie-room");

    document.getElementById("couple-status").classList.add("hidden");
    document.getElementById("couple-menu").classList.remove("hidden");
    document.getElementById("couple-active").classList.add("hidden");
}

function sendLikeToRoom(movie) {
    if (!currentRoom || !db) return;
    const movieKey = movie.title.replace(/[.#$/\[\]]/g, "").replace(/ /g, "_");
    db.ref("rooms/" + currentRoom + "/likes/" + movieKey + "/" + playerId).set({
        time: Date.now(),
        title: movie.title,
        poster: getPosterUrl(movie)
    });
}

function showCoupleMatch(movieTitle) {
    const overlay = document.getElementById("couple-match-overlay");
    document.getElementById("couple-match-title").textContent = movieTitle.replace(/_/g, " ");

    // Try to find the movie poster
    const movie = allMovies.find((m) => m.title.replace(/ /g, "_") === movieTitle.replace(/ /g, "_"));
    if (movie) {
        document.getElementById("couple-match-poster").src = getPosterUrl(movie);
    }

    overlay.classList.remove("hidden");

    if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100, 200]);

    if (typeof confetti !== "undefined") {
        setTimeout(() => {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ["#ec4899", "#a855f7", "#ef4444"] });
        }, 200);
    }
}

// --- AUTO-RECONNECT ---
(function () {
    const savedRoom = localStorage.getItem("zenmovie-room");
    if (savedRoom && isFirebaseConfigured()) {
        setTimeout(() => {
            if (initFirebase()) {
                db.ref("rooms/" + savedRoom).once("value").then((snap) => {
                    if (snap.exists()) {
                        db.ref("rooms/" + savedRoom + "/players/" + playerId).set(true);
                        joinRoomListeners(savedRoom);
                        showActiveRoom(savedRoom);
                    }
                });
            }
        }, 500);
    }
})();

/*
=== INSTRUCTIONS FIREBASE (GRATUIT) ===

1. Va sur https://console.firebase.google.com
2. Clique "Ajouter un projet" > donne un nom (ex: "zenmovie") > Continuer
3. Désactive Google Analytics si tu veux (pas nécessaire) > Créer
4. Dans le menu gauche, clique "Build" > "Realtime Database"
5. Clique "Créer une base de données"
6. Choisis un emplacement (europe-west1) > Suivant
7. Choisis "Mode test" (permet lecture/écriture pendant 30 jours) > Activer
8. Copie l'URL de la base (en haut, genre: https://zenmovie-xxxxx-default-rtdb.europe-west1.firebasedatabase.app)
9. C'est tout ! L'app te demandera cette URL au premier clic sur "Couple"
*/
