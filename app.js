const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_IMG_SMALL = "https://image.tmdb.org/t/p/w92";
const MATCH_RATING_THRESHOLD = 8.0;
const MIN_YEAR = 2000;

let allMovies = [];
let filteredMovies = [];
let currentIndex = 0;
let activeGenre = "Tous";
let watchlist = JSON.parse(localStorage.getItem("moviepicker-matches")) || [];
let swipedTitles = new Set(JSON.parse(localStorage.getItem("moviepicker-swiped")) || []);

const card = document.getElementById("movie-card");
const poster = document.getElementById("movie-poster");
const title = document.getElementById("movie-title");
const year = document.getElementById("movie-year");
const indicator = document.getElementById("swipe-indicator");
const remainingCount = document.getElementById("remaining-count");
const detailsOverlay = document.getElementById("details-overlay");
const detailsTitle = document.getElementById("details-title");
const detailsSummary = document.getElementById("details-summary");
const viewSwipe = document.getElementById("view-swipe");
const viewMatches = document.getElementById("view-matches");
const matchesList = document.getElementById("matches-list");
const matchesEmpty = document.getElementById("matches-empty");
const matchBadge = document.getElementById("match-badge");
const heartEl = document.querySelector(".heart-pulse");
const matchDetailsOverlay = document.getElementById("match-details-overlay");
const matchOverlay = document.getElementById("match-overlay");
const genreFilters = document.getElementById("genre-filters");

function saveWatchlist() {
    localStorage.setItem("moviepicker-matches", JSON.stringify(watchlist));
}

function saveSwiped(title) {
    swipedTitles.add(title);
    localStorage.setItem("moviepicker-swiped", JSON.stringify([...swipedTitles]));
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function updateRemaining() {
    const remaining = filteredMovies.length - currentIndex;
    remainingCount.textContent = remaining > 0 ? remaining : 0;
}

function updateBadge() {
    if (watchlist.length > 0) {
        matchBadge.textContent = watchlist.length;
        matchBadge.classList.remove("hidden");
    } else {
        matchBadge.classList.add("hidden");
    }
}

function hapticFeedback() {
    if (navigator.vibrate) {
        navigator.vibrate([30, 50, 80]);
    }
}

function showHeartAnimation() {
    heartEl.classList.remove("hidden");
    heartEl.classList.remove("heart-pulse");
    void heartEl.offsetWidth;
    heartEl.classList.add("heart-pulse");
    setTimeout(() => heartEl.classList.add("hidden"), 600);
}

function fireConfetti() {
    if (typeof confetti === "undefined") return;

    const count = 200;
    const defaults = { origin: { y: 0.6 }, zIndex: 200 };

    function fire(particleRatio, opts) {
        confetti({ ...defaults, particleCount: Math.floor(count * particleRatio), ...opts });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
}

function showMatchOverlay(movie) {
    const overlayPoster = document.getElementById("match-overlay-poster");
    const overlayTitle = document.getElementById("match-overlay-title");
    const overlayRating = document.getElementById("match-overlay-rating");

    overlayPoster.src = getPosterUrl(movie);
    overlayTitle.textContent = movie.title;

    const rating = movie.tmdb_rating || movie.rating || 0;
    const stars = Math.round(rating / 2);
    overlayRating.innerHTML = "⭐".repeat(stars) + ` ${rating}/10`;

    matchOverlay.classList.remove("hidden", "hiding");

    hapticFeedback();

    setTimeout(() => fireConfetti(), 300);
    setTimeout(() => fireConfetti(), 800);
}

function hideMatchOverlay() {
    matchOverlay.classList.add("hiding");
    setTimeout(() => {
        matchOverlay.classList.add("hidden");
        matchOverlay.classList.remove("hiding");
    }, 300);
}

// --- TMDB ---

async function searchTMDB(movieTitle, movieYear) {
    if (!TMDB_API_KEY) return null;
    try {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}&year=${movieYear}&language=fr-FR`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.results && data.results.length > 0) return data.results[0];
        const url2 = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}&language=fr-FR`;
        const res2 = await fetch(url2);
        if (!res2.ok) return null;
        const data2 = await res2.json();
        return data2.results?.[0] || null;
    } catch (e) {
        return null;
    }
}

async function getProviders(tmdbId) {
    if (!TMDB_API_KEY || !tmdbId) return null;
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.FR || data.results?.US || null;
    } catch (e) {
        return null;
    }
}

async function getTrailerUrl(tmdbId) {
    if (!TMDB_API_KEY || !tmdbId) return null;
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=fr-FR`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        let trailer = data.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");
        if (!trailer) {
            const urlEn = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
            const resEn = await fetch(urlEn);
            if (resEn.ok) {
                const dataEn = await resEn.json();
                trailer = dataEn.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");
                if (!trailer) trailer = dataEn.results?.find((v) => v.site === "YouTube");
            }
        }
        if (trailer) return `https://www.youtube.com/embed/${trailer.key}`;
        return null;
    } catch (e) {
        return null;
    }
}

function getPosterUrl(movie) {
    if (movie.tmdb_poster) return TMDB_IMG + movie.tmdb_poster;
    return movie.poster;
}

function getPosterSmall(movie) {
    if (movie.tmdb_poster) return TMDB_IMG_SMALL + movie.tmdb_poster;
    return movie.poster;
}

async function enrichMovie(movie) {
    if (movie.enriched) return movie;
    movie.enriched = true;
    const result = await searchTMDB(movie.title, movie.year);
    if (result) {
        movie.tmdb_id = result.id;
        if (result.poster_path) movie.tmdb_poster = result.poster_path;
        if (result.overview) movie.description = result.overview;
        if (result.vote_average) movie.tmdb_rating = result.vote_average;
    }
    return movie;
}

// --- FILTER ---

function applyFilter(genre) {
    activeGenre = genre;
    currentIndex = 0;

    let pool = allMovies.filter((m) => !swipedTitles.has(m.title));

    if (genre !== "Tous") {
        pool = pool.filter((m) => m.genre === genre);
    }

    filteredMovies = shuffle(pool);
    displayMovie();
}

// --- DISPLAY ---

async function displayMovie() {
    updateRemaining();

    if (currentIndex >= filteredMovies.length) {
        card.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-center p-6">
            <p class="text-lg">${
                filteredMovies.length === 0
                    ? "Aucun film dans ce genre."
                    : "Plus de films à découvrir !<br>Change de genre ou recharge la page."
            }</p>
        </div>`;
        return;
    }

    const movie = filteredMovies[currentIndex];
    poster.src = movie.poster;
    poster.alt = movie.title;
    title.textContent = movie.title;
    year.textContent = `${movie.year} — ${movie.genre}`;
    card.style.transform = "";
    card.style.opacity = "";
    card.classList.remove("swipe-left", "swipe-right", "swiping");

    // Card enter animation
    card.classList.add("card-enter");
    setTimeout(() => card.classList.remove("card-enter"), 400);

    await enrichMovie(movie);
    if (movie.tmdb_poster) poster.src = getPosterUrl(movie);

    if (currentIndex + 1 < filteredMovies.length) {
        enrichMovie(filteredMovies[currentIndex + 1]);
    }
}

function swipe(direction) {
    if (currentIndex >= filteredMovies.length) return;

    const movie = filteredMovies[currentIndex];
    saveSwiped(movie.title);

    if (direction === "right") {
        watchlist.push(movie);
        saveWatchlist();
        updateBadge();

        // Send to couple room if active
        if (currentRoom) sendLikeToRoom(movie);

        // Use local rating OR tmdb_rating
        const rating = movie.tmdb_rating || movie.rating || 0;
        const isMatch = rating >= MATCH_RATING_THRESHOLD;

        if (isMatch) {
            showMatchOverlay(movie);
        } else {
            showHeartAnimation();
            if (navigator.vibrate) navigator.vibrate(15);
        }
    }

    card.classList.add(direction === "right" ? "swipe-right" : "swipe-left");

    setTimeout(() => {
        currentIndex++;
        displayMovie();
    }, 400);
}

// --- MATCHES ---

function removeMatch(index) {
    const items = matchesList.querySelectorAll(".match-item");
    const item = items[index];
    if (item) {
        item.classList.add("removing");
        setTimeout(() => {
            watchlist.splice(index, 1);
            saveWatchlist();
            updateBadge();
            renderMatches();
        }, 300);
    }
}

async function showMatchDetails(movie) {
    document.getElementById("match-detail-poster").src = getPosterUrl(movie);
    document.getElementById("match-detail-title").textContent = movie.title;
    document.getElementById("match-detail-meta").textContent = `${movie.year} — ${movie.genre}`;
    document.getElementById("match-detail-description").textContent = movie.description;

    const providersList = document.getElementById("providers-list");
    const providersEmpty = document.getElementById("providers-empty");
    const providersLoading = document.getElementById("providers-loading");

    providersList.innerHTML = "";
    providersEmpty.classList.add("hidden");
    providersLoading.classList.remove("hidden");
    matchDetailsOverlay.classList.remove("hidden");

    if (!movie.tmdb_id) {
        await enrichMovie(movie);
        document.getElementById("match-detail-poster").src = getPosterUrl(movie);
        document.getElementById("match-detail-description").textContent = movie.description;
    }

    if (movie.tmdb_id) {
        const providers = await getProviders(movie.tmdb_id);
        providersLoading.classList.add("hidden");

        if (providers) {
            const all = [
                ...(providers.flatrate || []),
                ...(providers.rent || []),
                ...(providers.buy || [])
            ];
            const seen = new Set();
            const unique = all.filter((p) => {
                if (seen.has(p.provider_id)) return false;
                seen.add(p.provider_id);
                return true;
            });

            if (unique.length > 0) {
                unique.forEach((p) => {
                    const tag = document.createElement("div");
                    tag.className = "flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2";
                    const logoUrl = p.logo_path ? `https://image.tmdb.org/t/p/w45${p.logo_path}` : "";
                    tag.innerHTML = `
                        ${logoUrl ? `<img src="${logoUrl}" alt="${p.provider_name}" class="w-6 h-6 rounded">` : ""}
                        <span class="text-white text-xs">${p.provider_name}</span>
                    `;
                    providersList.appendChild(tag);
                });
            } else {
                providersEmpty.classList.remove("hidden");
            }
        } else {
            providersEmpty.classList.remove("hidden");
        }
    } else {
        providersLoading.classList.add("hidden");
        providersEmpty.classList.remove("hidden");
    }
}

function renderMatches() {
    matchesList.innerHTML = "";

    if (watchlist.length === 0) {
        matchesEmpty.classList.remove("hidden");
        return;
    }

    matchesEmpty.classList.add("hidden");

    watchlist.forEach((movie, i) => {
        const rating = movie.tmdb_rating || movie.rating || 0;
        const li = document.createElement("li");
        li.className = "match-item flex items-center gap-3 bg-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-700 transition-colors";
        li.innerHTML = `
            <img src="${getPosterSmall(movie)}" alt="${movie.title}" class="w-12 h-16 object-cover rounded-lg flex-shrink-0">
            <div class="flex-1 min-w-0">
                <p class="text-white font-medium text-sm truncate">${movie.title}</p>
                <p class="text-gray-400 text-xs">${movie.year} — ${movie.genre}${rating ? ` — ⭐ ${rating}` : ""}</p>
            </div>
            <button class="btn-remove flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors" data-index="${i}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        `;

        li.addEventListener("click", (e) => {
            if (e.target.closest(".btn-remove")) return;
            showMatchDetails(movie);
        });

        matchesList.appendChild(li);
    });

    matchesList.querySelectorAll(".btn-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeMatch(parseInt(btn.dataset.index));
        });
    });
}

// --- NAVIGATION ---

function showMatches() {
    viewSwipe.classList.add("hidden");
    viewMatches.classList.remove("hidden");
    genreFilters.classList.add("hidden");
    renderMatches();
}

function showSwipe() {
    viewMatches.classList.add("hidden");
    viewSwipe.classList.remove("hidden");
    genreFilters.classList.remove("hidden");
}

// --- SWIPE GESTURES ---

function initSwipe() {
    const hammer = new Hammer(card);
    hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL });

    hammer.on("pan", (e) => {
        if (currentIndex >= filteredMovies.length) return;
        card.classList.add("swiping");

        const maxRotation = 15;
        const rotation = Math.max(-maxRotation, Math.min(maxRotation, e.deltaX * 0.08));
        const lift = Math.min(Math.abs(e.deltaX) * 0.1, 15);

        card.style.transform = `translateX(${e.deltaX}px) rotate(${rotation}deg) translateY(-${lift}px)`;

        indicator.classList.remove("like", "dislike");
        if (e.deltaX > 60) {
            indicator.textContent = "À VOIR";
            indicator.classList.add("like");
        } else if (e.deltaX < -60) {
            indicator.textContent = "PASSER";
            indicator.classList.add("dislike");
        } else {
            indicator.textContent = "";
        }
    });

    hammer.on("panend", (e) => {
        if (currentIndex >= filteredMovies.length) return;
        card.classList.remove("swiping");
        indicator.textContent = "";
        indicator.classList.remove("like", "dislike");

        if (e.deltaX > 100 || (e.deltaX > 50 && e.velocityX > 0.5)) {
            swipe("right");
        } else if (e.deltaX < -100 || (e.deltaX < -50 && e.velocityX < -0.5)) {
            swipe("left");
        } else {
            card.style.transform = "";
        }
    });
}

// --- EVENT LISTENERS ---

document.getElementById("btn-like").addEventListener("click", () => swipe("right"));
document.getElementById("btn-dislike").addEventListener("click", () => swipe("left"));
document.getElementById("btn-toggle-matches").addEventListener("click", showMatches);
document.getElementById("btn-back-swipe").addEventListener("click", showSwipe);
document.getElementById("btn-continue-swipe").addEventListener("click", hideMatchOverlay);

document.getElementById("btn-details").addEventListener("click", async () => {
    if (currentIndex >= filteredMovies.length) return;
    const movie = filteredMovies[currentIndex];
    detailsTitle.textContent = `${movie.title} (${movie.year})`;
    detailsSummary.textContent = movie.description;

    const trailerContainer = document.getElementById("details-trailer");
    const trailerIframe = document.getElementById("details-trailer-iframe");
    const trailerLoading = document.getElementById("details-trailer-loading");

    trailerContainer.classList.add("hidden");
    trailerIframe.src = "";
    trailerLoading.classList.remove("hidden");
    detailsOverlay.classList.remove("hidden");

    if (!movie.tmdb_id) await enrichMovie(movie);

    const trailerUrl = await getTrailerUrl(movie.tmdb_id);
    trailerLoading.classList.add("hidden");

    if (trailerUrl) {
        trailerIframe.src = trailerUrl;
        trailerContainer.classList.remove("hidden");
    }
});

function closeDetails() {
    detailsOverlay.classList.add("hidden");
    document.getElementById("details-trailer-iframe").src = "";
}

document.getElementById("btn-close-details").addEventListener("click", closeDetails);

detailsOverlay.addEventListener("click", (e) => {
    if (e.target === detailsOverlay) closeDetails();
});

document.getElementById("btn-close-match-details").addEventListener("click", () => {
    matchDetailsOverlay.classList.add("hidden");
});

matchDetailsOverlay.addEventListener("click", (e) => {
    if (e.target === matchDetailsOverlay) matchDetailsOverlay.classList.add("hidden");
});

genreFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".genre-btn");
    if (!btn) return;
    genreFilters.querySelectorAll(".genre-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilter(btn.dataset.genre);
});

// --- RANDOM PICK ---

function pickRandomMovie() {
    if (watchlist.length === 0) return;
    const movie = watchlist[Math.floor(Math.random() * watchlist.length)];
    const overlay = document.getElementById("random-pick-overlay");
    const posterEl = document.getElementById("random-pick-poster");

    document.getElementById("random-pick-title").textContent = movie.title;
    document.getElementById("random-pick-meta").textContent = `${movie.year} — ${movie.genre}`;
    posterEl.src = getPosterUrl(movie);

    // Reset animation
    posterEl.classList.remove("random-pick-reveal");
    void posterEl.offsetWidth;
    posterEl.classList.add("random-pick-reveal");

    overlay.classList.remove("hidden");

    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
}

document.getElementById("btn-random-pick").addEventListener("click", pickRandomMovie);
document.getElementById("btn-random-pick-again").addEventListener("click", pickRandomMovie);
document.getElementById("btn-random-pick-close").addEventListener("click", () => {
    document.getElementById("random-pick-overlay").classList.add("hidden");
});
document.getElementById("random-pick-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("random-pick-overlay")) {
        document.getElementById("random-pick-overlay").classList.add("hidden");
    }
});

// --- COUPLE MODE LISTENERS ---

document.getElementById("btn-couple-mode").addEventListener("click", () => {
    document.getElementById("couple-overlay").classList.remove("hidden");
});

document.getElementById("btn-close-couple").addEventListener("click", () => {
    document.getElementById("couple-overlay").classList.add("hidden");
});

document.getElementById("btn-create-room").addEventListener("click", createRoom);

document.getElementById("btn-join-room").addEventListener("click", () => {
    const code = document.getElementById("input-room-code").value.trim();
    joinRoom(code);
});

document.getElementById("input-room-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const code = document.getElementById("input-room-code").value.trim();
        joinRoom(code);
    }
});

document.getElementById("btn-leave-room").addEventListener("click", () => {
    leaveRoom();
});

document.getElementById("btn-close-couple-match").addEventListener("click", () => {
    document.getElementById("couple-match-overlay").classList.add("hidden");
});

document.getElementById("couple-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("couple-overlay")) {
        document.getElementById("couple-overlay").classList.add("hidden");
    }
});

// --- TMDB DISCOVER ---

const TMDB_GENRE_MAP = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
    80: "Crime", 18: "Drame", 14: "Fantaisie", 27: "Horreur",
    10749: "Romance", 878: "Science-Fiction", 53: "Thriller", 10752: "Guerre", 37: "Western"
};

async function fetchTmdbDiscover(page) {
    if (!TMDB_API_KEY) return [];
    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&primary_release_date.gte=${MIN_YEAR}-01-01&primary_release_date.lte=2026-12-31&vote_count.gte=100&page=${page}`;
    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results.map((m) => ({
            title: m.title,
            year: parseInt(m.release_date?.substring(0, 4)) || 2020,
            genre: TMDB_GENRE_MAP[m.genre_ids?.[0]] || "Drame",
            description: m.overview || "",
            poster: m.poster_path ? TMDB_IMG + m.poster_path : "https://picsum.photos/300/450",
            rating: m.vote_average || 0,
            tmdb_id: m.id,
            tmdb_poster: m.poster_path,
            tmdb_rating: m.vote_average,
            enriched: true
        }));
    } catch (e) {
        return [];
    }
}

async function loadMovies() {
    let movies = [];

    if (TMDB_API_KEY) {
        const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = await Promise.all(pages.map((p) => fetchTmdbDiscover(p)));
        movies = results.flat();
    }

    if (movies.length === 0) {
        const res = await fetch("movies.json");
        const data = await res.json();
        movies = data.filter((m) => m.year >= MIN_YEAR);
    }

    return movies;
}

// --- INIT ---

updateBadge();

loadMovies()
    .then((data) => {
        allMovies = data;
        applyFilter("Tous");
        initSwipe();
    })
    .catch((err) => {
        card.innerHTML = `<div class="flex items-center justify-center h-full text-red-400 text-center p-6">
            <p>Erreur de chargement.<br>Lance un serveur local.</p>
        </div>`;
        console.error("Erreur chargement:", err);
    });
