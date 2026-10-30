/* NepMovies — central config. No build step, no secrets in code. */
(function () {
  "use strict";
  window.NM = window.NM || {};
  Object.assign(window.NM, {
    APP_NAME: "NepMovies",
    VERSION: "v1",

    TMDB_API: "https://api.themoviedb.org/3",
    IMG: "https://image.tmdb.org/t/p/",
    poster: function (path, size) {
      if (!path) return "";
      return this.IMG + (size || "w500") + path;
    },
    backdrop: function (path, size) {
      if (!path) return "";
      return this.IMG + (size || "w1280") + path;
    },

    getKey: function () {
      try { return (localStorage.getItem("nm_tmdb_key") || "").trim(); } catch (e) { return ""; }
    },
    setKey: function (k) {
      try {
        k = (k || "").trim();
        if (k) localStorage.setItem("nm_tmdb_key", k);
        else localStorage.removeItem("nm_tmdb_key");
      } catch (e) {}
    },
    hasKey: function () { return this.getKey().length > 10; },

    LANGS: [
      { code: "all", label: "All" },
      { code: "en", label: "English" },
      { code: "hi", label: "Hindi" },
      { code: "ne", label: "Nepali" },
      { code: "ko", label: "Korean" },
      { code: "es", label: "Spanish" },
      { code: "ja", label: "Japanese" },
    ],

    GENRES: {
      28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
      99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
      27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
      878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
    },
  });
})();
