let peer = null;
let conn = null;
let currentRoom = null;
let isHost = false;
let myLikes = new Set();
let partnerLikes = new Set();

const ROOM_PREFIX = "zenmovie-room-";

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function createRoom() {
    const code = generateRoomCode();
    const peerId = ROOM_PREFIX + code;

    peer = new Peer(peerId);
    isHost = true;

    peer.on("open", () => {
        currentRoom = code;
        showActiveRoom(code);
        updateCoupleStatus("En attente...");
    });

    peer.on("connection", (connection) => {
        conn = connection;
        setupConnection();
        updateCoupleStatus("Connecté !");
        updatePlayerCount(2);
    });

    peer.on("error", (err) => {
        if (err.type === "unavailable-id") {
            alert("Ce code est déjà pris. Réessaie.");
        } else {
            console.error("PeerJS error:", err);
            alert("Erreur de connexion. Réessaie.");
        }
    });
}

function joinRoom(code) {
    if (!code || code.length !== 4) {
        alert("Entre un code à 4 chiffres.");
        return;
    }

    const peerId = "zenmovie-joiner-" + Math.random().toString(36).substring(2, 8);
    peer = new Peer(peerId);
    isHost = false;

    peer.on("open", () => {
        conn = peer.connect(ROOM_PREFIX + code, { reliable: true });

        conn.on("open", () => {
            currentRoom = code;
            showActiveRoom(code);
            setupConnection();
            updateCoupleStatus("Connecté !");
            updatePlayerCount(2);
        });

        conn.on("error", () => {
            alert("Impossible de rejoindre. Vérifie le code.");
        });
    });

    peer.on("error", (err) => {
        if (err.type === "peer-unavailable") {
            alert("Room introuvable. Vérifie le code.");
        } else {
            console.error("PeerJS error:", err);
            alert("Erreur de connexion. Réessaie.");
        }
    });
}

function setupConnection() {
    conn.on("data", (data) => {
        if (data.type === "like") {
            partnerLikes.add(data.movieKey);
            if (myLikes.has(data.movieKey)) {
                showCoupleMatch(data.title);
            }
        }
    });

    conn.on("close", () => {
        updateCoupleStatus("Déconnecté");
        updatePlayerCount(1);
        conn = null;
    });
}

function updateCoupleStatus(text) {
    const el = document.getElementById("couple-status");
    el.textContent = "Room " + currentRoom + " — " + text;
    el.classList.remove("hidden");
}

function updatePlayerCount(count) {
    const el = document.getElementById("couple-players");
    if (el) {
        el.textContent = count + " joueur" + (count > 1 ? "s" : "") + " connecté" + (count > 1 ? "s" : "");
    }
}

function showActiveRoom(code) {
    document.getElementById("couple-menu").classList.add("hidden");
    document.getElementById("couple-active").classList.remove("hidden");
    document.getElementById("couple-room-code").textContent = code;
}

function leaveRoom() {
    if (conn) conn.close();
    if (peer) peer.destroy();
    peer = null;
    conn = null;
    currentRoom = null;
    isHost = false;
    myLikes = new Set();
    partnerLikes = new Set();

    document.getElementById("couple-status").classList.add("hidden");
    document.getElementById("couple-menu").classList.remove("hidden");
    document.getElementById("couple-active").classList.add("hidden");
}

function sendLikeToRoom(movie) {
    if (!conn || !conn.open) return;
    const movieKey = movie.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    myLikes.add(movieKey);

    conn.send({
        type: "like",
        movieKey: movieKey,
        title: movie.title
    });

    if (partnerLikes.has(movieKey)) {
        showCoupleMatch(movie.title);
    }
}

function showCoupleMatch(movieTitle) {
    const overlay = document.getElementById("couple-match-overlay");
    document.getElementById("couple-match-title").textContent = movieTitle;

    const movie = allMovies.find((m) => m.title === movieTitle);
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
