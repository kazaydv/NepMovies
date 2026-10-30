/* NepMovies — data layer. TMDB when a key is set, curated seed otherwise. */
(function () {
  "use strict";
  var NM = window.NM;

  function seed() { return window.NM_SEED || []; }

  function normTmdb(m) {
    var date = m.release_date || "";
    var genres = (m.genre_ids || []).map(function (g) { return NM.GENRES[g]; }).filter(Boolean);
    return {
      id: String(m.id),
      title: m.title || m.name || "Untitled",
      year: date ? parseInt(date.slice(0, 4), 10) : null,
      overview: m.overview || "",
      genres: genres,
      lang: m.original_language || "",
      poster: NM.poster(m.poster_path),
      backdrop: NM.backdrop(m.backdrop_path),
      trailer: "",
      rating: Math.round((m.vote_average || 0) * 10) / 10,
      kind: "movie",
    };
  }

  function normSeed(m) {
    return {
      id: String(m.id), title: m.title, year: m.year, overview: m.overview || "",
      genres: m.genres || [], lang: m.lang || "", poster: m.poster || "",
      backdrop: m.backdrop || "", trailer: m.trailer || "", rating: m.rating || 0,
      kind: "movie",
    };
  }

  async function tmdb(path, params) {
    var key = NM.getKey();
    if (!key) throw new Error("no-key");
    var url = NM.TMDB_API + path + "?api_key=" + encodeURIComponent(key) + "&language=en-US";
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== "") url += "&" + k + "=" + encodeURIComponent(params[k]);
      });
    }
    var res = await fetch(url);
    if (!res.ok) throw new Error("tmdb-" + res.status);
    return res.json();
  }

  function pickTrailer(videos) {
    var vids = (videos && videos.results) || [];
    var yt = vids.filter(function (v) { return v.site === "YouTube"; });
    var t = yt.find(function (v) { return v.type === "Trailer" && v.official; })
      || yt.find(function (v) { return v.type === "Trailer"; })
      || yt.find(function (v) { return v.type === "Teaser"; })
      || yt[0];
    return t ? t.key : "";
  }

  NM.api = {
    hasKey: function () { return NM.hasKey(); },

    /* rows for the home screen: [{title, items:[movie]}] */
    homeRows: async function () {
      if (NM.hasKey()) {
        try { return await this._tmdbRows(); } catch (e) { /* fall through to seed */ }
      }
      return this._seedRows();
    },

    _tmdbRows: async function () {
      var lang = NM.store.getLang();
      var langParam = lang === "all" ? undefined : lang;
      var defs = [
        ["Trending Now", tmdb("/trending/movie/week", {})],
        ["Popular Movies", tmdb("/movie/popular", {})],
        ["Top Rated", tmdb("/movie/top_rated", {})],
      ];
      if (langParam) {
        defs.push(["Top in " + langLabel(lang), tmdb("/discover/movie", {
          with_original_language: langParam, sort_by: "popularity.desc", "vote_count.gte": 20,
        })]);
      } else {
        defs.push(["Hindi Blockbusters", tmdb("/discover/movie", { with_original_language: "hi", sort_by: "popularity.desc", "vote_count.gte": 20 })]);
        defs.push(["Korean Picks", tmdb("/discover/movie", { with_original_language: "ko", sort_by: "popularity.desc", "vote_count.gte": 20 })]);
        defs.push(["Nepali Cinema", tmdb("/discover/movie", { with_original_language: "ne", sort_by: "popularity.desc" })]);
      }
      defs.push(["Action & Thriller", tmdb("/discover/movie", { with_genres: "28,53", sort_by: "popularity.desc", with_original_language: langParam })]);
      defs.push(["Comedy Night", tmdb("/discover/movie", { with_genres: "35", sort_by: "popularity.desc", with_original_language: langParam })]);

      var rows = [];
      for (var i = 0; i < defs.length; i++) {
        try {
          var data = await defs[i][1];
          var items = (data.results || []).filter(function (m) { return m.poster_path; }).map(normTmdb);
          if (items.length) rows.push({ title: defs[i][0], items: items });
        } catch (e) { /* skip a failed row, keep the rest */ }
      }
      if (!rows.length) return this._seedRows();
      return rows;
    },

    _seedRows: function () {
      var s = seed().map(normSeed);
      var byLang = function (c) { return s.filter(function (m) { return m.lang === c; }); };
      var byGenre = function (g) { return s.filter(function (m) { return m.genres.indexOf(g) >= 0; }); };
      var top = s.slice().sort(function (a, b) { return b.rating - a.rating; });
      var lang = NM.store.getLang();
      var rows = [];
      if (lang !== "all") {
        var items = byLang(lang);
        if (items.length) rows.push({ title: langLabel(lang) + " Movies", items: items });
      } else {
        rows.push({ title: "Trending Now", items: top.slice(0, 12) });
        var hi = byLang("hi"), ko = byLang("ko"), ne = byLang("ne");
        if (hi.length) rows.push({ title: "Hindi Blockbusters", items: hi });
        if (ko.length) rows.push({ title: "Korean Picks", items: ko });
        if (ne.length) rows.push({ title: "Nepali Cinema", items: ne });
      }
      var action = byGenre("Action").concat(byGenre("Thriller"));
      if (action.length > 3) rows.push({ title: "Action & Thriller", items: action });
      var comedy = byGenre("Comedy");
      if (comedy.length > 3) rows.push({ title: "Comedy Night", items: comedy });
      rows.push({ title: "Top Rated", items: top });
      return rows;
    },

    heroPicks: async function () {
      var rows = await this.homeRows();
      var pool = rows.length && rows[0].items.length ? rows[0].items : [];
      // prefer items with backdrops for the hero
      pool = pool.filter(function (m) { return m.backdrop; });
      return pool.slice(0, 6);
    },

    search: async function (q) {
      q = (q || "").trim();
      if (!q) return [];
      if (NM.hasKey()) {
        try {
          var data = await tmdb("/search/movie", { query: q, include_adult: "false" });
          return (data.results || []).filter(function (m) { return m.poster_path; }).map(normTmdb).slice(0, 24);
        } catch (e) { /* fall through */ }
      }
      var ql = q.toLowerCase();
      return seed().map(normSeed).filter(function (m) {
        return (m.title + " " + (m.genres || []).join(" ")).toLowerCase().indexOf(ql) >= 0;
      }).slice(0, 24);
    },

    details: async function (id) {
      id = String(id).replace(/^vid_/, "");
      var fromSeed = seed().map(normSeed).find(function (m) { return String(m.id) === String(id); });
      if (NM.hasKey() && String(id).indexOf("vid_") !== 0) {
        try {
          var d = await tmdb("/movie/" + id, { append_to_response: "videos,credits,similar" });
          var m = normTmdb(d);
          m.overview = d.overview || m.overview;
          m.genres = (d.genres || []).map(function (g) { return g.name; });
          m.trailer = pickTrailer(d.videos);
          m.cast = (d.credits && d.credits.cast || []).slice(0, 8).map(function (c) { return c.name; });
          m.similar = (d.similar && d.similar.results || []).filter(function (x) { return x.poster_path; }).map(normTmdb).slice(0, 12);
          m.runtime = d.runtime || null;
          return m;
        } catch (e) { /* fall through to seed */ }
      }
      if (fromSeed) {
        fromSeed.similar = seed().map(normSeed).filter(function (x) {
          return String(x.id) !== String(id) &&
            x.genres.some(function (g) { return fromSeed.genres.indexOf(g) >= 0; });
        }).slice(0, 12);
        return fromSeed;
      }
      return null;
    },
  };

  function langLabel(code) {
    var l = NM.LANGS.find(function (x) { return x.code === code; });
    return l ? l.label : code;
  }
  NM.langLabel = langLabel;
})();
