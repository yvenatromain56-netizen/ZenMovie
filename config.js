function getTmdbApiKey() {
    let key = localStorage.getItem("moviepicker-tmdb-key");
    if (!key) {
        key = prompt(
            "Pour afficher les vraies affiches, entre ta clé API TMDB.\n\n" +
            "Pour en obtenir une (gratuit) :\n" +
            "1. Va sur themoviedb.org/signup\n" +
            "2. Paramètres > API > Créer (Developer)\n" +
            "3. Copie la 'Clé API (v3 auth)'\n\n" +
            "Colle-la ici :"
        );
        if (key && key.trim().length > 10) {
            localStorage.setItem("moviepicker-tmdb-key", key.trim());
        } else {
            key = null;
        }
    }
    return key;
}

const TMDB_API_KEY = getTmdbApiKey();
