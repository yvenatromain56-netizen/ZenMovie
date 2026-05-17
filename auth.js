let supabase = null;
let currentUser = null;
let authMode = "login";

function isSupabaseConfigured() {
    return SUPABASE_URL && SUPABASE_URL.length > 10 && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 10;
}

function initSupabase() {
    if (!isSupabaseConfigured()) return false;
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } catch (e) {
        console.error("Supabase init error:", e);
        return false;
    }
}

function showAuthScreen() {
    document.getElementById("auth-screen").classList.remove("hidden");
}

function hideAuthScreen() {
    document.getElementById("auth-screen").classList.add("hidden");
}

function showAuthError(msg) {
    const el = document.getElementById("auth-error");
    el.textContent = msg;
    el.classList.remove("hidden");
}

function hideAuthError() {
    document.getElementById("auth-error").classList.add("hidden");
}

// --- AUTH UI ---

document.getElementById("tab-login").addEventListener("click", () => {
    authMode = "login";
    document.getElementById("tab-login").className = "flex-1 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white transition-all";
    document.getElementById("tab-signup").className = "flex-1 py-2 text-sm font-medium rounded-lg text-gray-400 transition-all";
    document.getElementById("btn-auth-submit").textContent = "Se connecter";
});

document.getElementById("tab-signup").addEventListener("click", () => {
    authMode = "signup";
    document.getElementById("tab-signup").className = "flex-1 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white transition-all";
    document.getElementById("tab-login").className = "flex-1 py-2 text-sm font-medium rounded-lg text-gray-400 transition-all";
    document.getElementById("btn-auth-submit").textContent = "Créer un compte";
});

document.getElementById("btn-auth-submit").addEventListener("click", async () => {
    hideAuthError();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    if (!email || !password) {
        showAuthError("Remplis tous les champs.");
        return;
    }

    if (password.length < 6) {
        showAuthError("Le mot de passe doit faire 6 caractères minimum.");
        return;
    }

    const btn = document.getElementById("btn-auth-submit");
    btn.disabled = true;
    btn.textContent = "Chargement...";

    try {
        let result;
        if (authMode === "signup") {
            result = await supabase.auth.signUp({ email, password });
        } else {
            result = await supabase.auth.signInWithPassword({ email, password });
        }

        if (result.error) {
            showAuthError(result.error.message);
            btn.disabled = false;
            btn.textContent = authMode === "login" ? "Se connecter" : "Créer un compte";
            return;
        }

        if (authMode === "signup" && result.data?.user && !result.data.session) {
            showAuthError("Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.");
            btn.disabled = false;
            btn.textContent = "Créer un compte";
            return;
        }

        currentUser = result.data.user;
        onAuthSuccess();
    } catch (e) {
        showAuthError("Erreur de connexion.");
        btn.disabled = false;
        btn.textContent = authMode === "login" ? "Se connecter" : "Créer un compte";
    }
});

document.getElementById("auth-email").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("auth-password").focus();
});

document.getElementById("auth-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-auth-submit").click();
});

document.getElementById("btn-auth-skip").addEventListener("click", () => {
    currentUser = null;
    hideAuthScreen();
    startApp();
});

document.getElementById("btn-logout").addEventListener("click", async () => {
    if (supabase) await supabase.auth.signOut();
    currentUser = null;
    document.getElementById("btn-logout").classList.add("hidden");
    showAuthScreen();
});

// --- SYNC ---

async function syncWatchlistToCloud() {
    if (!supabase || !currentUser) return;
    try {
        await supabase.from("watchlist").upsert(
            watchlist.map((movie) => ({
                user_id: currentUser.id,
                title: movie.title,
                data: movie
            })),
            { onConflict: "user_id,title" }
        );
    } catch (e) {
        console.error("Sync to cloud error:", e);
    }
}

async function syncSwipedToCloud() {
    if (!supabase || !currentUser) return;
    try {
        const titles = [...swipedTitles];
        await supabase.from("swiped").upsert(
            titles.map((t) => ({
                user_id: currentUser.id,
                title: t
            })),
            { onConflict: "user_id,title" }
        );
    } catch (e) {
        console.error("Sync swiped error:", e);
    }
}

async function loadWatchlistFromCloud() {
    if (!supabase || !currentUser) return;
    try {
        const { data } = await supabase
            .from("watchlist")
            .select("data")
            .eq("user_id", currentUser.id);
        if (data && data.length > 0) {
            watchlist = data.map((row) => row.data);
            saveWatchlist();
        }
    } catch (e) {
        console.error("Load watchlist error:", e);
    }
}

async function loadSwipedFromCloud() {
    if (!supabase || !currentUser) return;
    try {
        const { data } = await supabase
            .from("swiped")
            .select("title")
            .eq("user_id", currentUser.id);
        if (data && data.length > 0) {
            swipedTitles = new Set(data.map((row) => row.title));
            localStorage.setItem("moviepicker-swiped", JSON.stringify([...swipedTitles]));
        }
    } catch (e) {
        console.error("Load swiped error:", e);
    }
}

async function removeFromCloud(movieTitle) {
    if (!supabase || !currentUser) return;
    try {
        await supabase
            .from("watchlist")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("title", movieTitle);
    } catch (e) {
        console.error("Remove from cloud error:", e);
    }
}

// --- AUTH FLOW ---

async function onAuthSuccess() {
    hideAuthScreen();
    document.getElementById("btn-logout").classList.remove("hidden");
    await loadWatchlistFromCloud();
    await loadSwipedFromCloud();
    updateBadge();
    startApp();
}

async function checkExistingSession() {
    if (!initSupabase()) {
        hideAuthScreen();
        startApp();
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        onAuthSuccess();
    } else {
        showAuthScreen();
    }
}

checkExistingSession();
