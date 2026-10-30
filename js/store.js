/* NepMovies — local persistence: My List, Continue Watching, My Videos, prefs. */
(function () {
  "use strict";
  var NM = window.NM;

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  NM.store = {
    /* ---- My List ---- */
    list: function () { return read("nm_mylist", []); },
    inList: function (id) {
      return this.list().some(function (m) { return String(m.id) === String(id); });
    },
    toggleList: function (movie) {
      var list = this.list();
      var i = list.findIndex(function (m) { return String(m.id) === String(movie.id); });
      var added;
      if (i >= 0) { list.splice(i, 1); added = false; }
      else { list.unshift(NM.pick(movie)); added = true; }
      write("nm_mylist", list.slice(0, 200));
      return added;
    },

    /* ---- Continue Watching: { id: {t, d, title, poster, backdrop, kind, url} } ---- */
    progress: function () { return read("nm_progress", {}); },
    saveProgress: function (movie, t, d) {
      if (!movie || !d || d <= 0) return;
      if (t < 8 || t / d > 0.96) { this.clearProgress(movie.id); return; }
      var p = this.progress();
      p[String(movie.id)] = Object.assign(NM.pick(movie), { t: Math.floor(t), d: Math.floor(d) });
      write("nm_progress", p);
    },
    getProgress: function (id) { return this.progress()[String(id)] || null; },
    clearProgress: function (id) {
      var p = this.progress();
      delete p[String(id)];
      write("nm_progress", p);
    },
    progressList: function () {
      var p = this.progress();
      return Object.keys(p).map(function (k) { return p[k]; });
    },

    /* ---- My Videos (user-added mp4 links; files are session-only) ---- */
    videos: function () { return read("nm_videos", []); },
    addVideo: function (title, url) {
      var vids = this.videos();
      vids.unshift({ id: "vid_" + Date.now(), title: title || "My video", url: url, kind: "file" });
      write("nm_videos", vids.slice(0, 100));
      return vids[0];
    },
    removeVideo: function (id) {
      write("nm_videos", this.videos().filter(function (v) { return v.id !== id; }));
    },

    /* ---- prefs ---- */
    getLang: function () { return read("nm_lang", "all"); },
    setLang: function (c) { write("nm_lang", c); },
    keyBannerDismissed: function () { return read("nm_keybanner", false); },
    dismissKeyBanner: function () { write("nm_keybanner", true); },
  };

  /* keep only the fields a card/row needs */
  NM.pick = function (m) {
    return {
      id: m.id, title: m.title, year: m.year, overview: m.overview,
      genres: m.genres || [], lang: m.lang || "", poster: m.poster || "",
      backdrop: m.backdrop || "", trailer: m.trailer || "", rating: m.rating || 0,
      kind: m.kind || "movie", url: m.url || "",
    };
  };
})();
