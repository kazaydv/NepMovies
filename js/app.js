/* NepMovies — home UI: hero, rows, cards, modal, search, lists, settings. */
(function () {
  "use strict";
  var NM = window.NM;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- toast ---------- */
  var toastT = null;
  NM.toast = function (msg) {
    $("#toastMsg").textContent = msg;
    var t = $("#toast");
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("on"); }, 2600);
  };

  /* ---------- image fade-in ---------- */
  function watchImgs(root) {
    $$("img[data-fade]", root).forEach(function (img) {
      if (img.complete && img.naturalWidth) { img.classList.add("loaded"); return; }
      img.addEventListener("load", function () { img.classList.add("loaded"); }, { once: true });
      img.addEventListener("error", function () {
        img.style.opacity = "0";
        var p = img.closest(".card-img"); if (p) p.style.background = "linear-gradient(135deg,#1e1e28,#14141b)";
      }, { once: true });
    });
  }

  /* ---------- cards ---------- */
  NM.cardHTML = function (m, opts) {
    opts = opts || {};
    var prog = NM.store.getProgress(m.id);
    var badge = opts.badge ? '<span class="card-badge hot">' + opts.badge + "</span>" : "";
    var bar = prog ? '<div class="card-progress"><i style="width:' + Math.round(prog.t / prog.d * 100) + '%"></i></div>' : "";
    return '<div class="card' + (opts.wide ? " card-wide" : "") + '" data-id="' + m.id + '" data-kind="' + (m.kind || "movie") + '" tabindex="0" role="button" aria-label="' + esc(m.title) + '">' +
      badge +
      '<div class="card-img"><img data-fade loading="lazy" src="' + m.poster + '" alt="' + esc(m.title) + '"><div class="card-grad"></div>' +
      '<div class="card-info"><div class="t">' + esc(m.title) + '</div>' +
      '<div class="m"><span class="rate">★ ' + (m.rating || "–") + "</span><span>" + (m.year || "") + "</span></div></div></div>" +
      bar + "</div>";
  };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function bindCards(root) {
    $$(".card", root).forEach(function (c) {
      c.addEventListener("click", function () { openDetail(c.dataset.id, c.dataset.kind); });
      c.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(c.dataset.id, c.dataset.kind); }
      });
    });
    watchImgs(root);
  }

  /* ---------- nav / views ---------- */
  var currentView = "home";
  function go(view) {
    currentView = view;
    $$(".view").forEach(function (v) { v.classList.toggle("on", v.id === "view-" + view); });
    $$('[data-nav]').forEach(function (b) { b.classList.toggle("active", b.dataset.nav === view); });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (view === "mylist") renderList();
    if (view === "myvideos") renderVideos();
    if (view === "search") setTimeout(function () { $("#searchInput").focus(); }, 80);
  }
  document.addEventListener("click", function (e) {
    var n = e.target.closest("[data-nav]");
    if (n) { e.preventDefault(); go(n.dataset.nav); }
    var cl = e.target.closest("[data-close]");
    if (cl) $("#" + cl.dataset.close).classList.remove("on");
  });
  $("#searchBtn").addEventListener("click", function () { go("search"); });
  $("#settingsBtn").addEventListener("click", function () { openSettings(); });
  window.addEventListener("scroll", function () {
    $("#nav").classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { $$(".modal-veil.on").forEach(function (v) { v.classList.remove("on"); }); }
  });

  /* ---------- language chips ---------- */
  function renderChips() {
    var cur = NM.store.getLang();
    var html = NM.LANGS.map(function (l) {
      return '<button class="chip' + (l.code === cur ? " active" : "") + '" data-lang="' + l.code + '">' + l.label + "</button>";
    }).join("");
    $("#langChips").innerHTML = html;
    $("#setLangChips").innerHTML = html;
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-lang]");
    if (!c) return;
    NM.store.setLang(c.dataset.lang);
    renderChips();
    loadHome(true);
    NM.toast("Showing " + NM.langLabel(c.dataset.lang) + " picks");
  });

  /* ---------- hero ---------- */
  var heroItems = [], heroIdx = 0, heroTimer = null;
  function renderHero(items) {
    heroItems = items.filter(function (m) { return m.backdrop; }).slice(0, 6);
    if (!heroItems.length) { $("#hero").style.display = "none"; return; }
    $("#hero").style.display = "";
    $("#heroBgs").innerHTML = heroItems.map(function (m, i) {
      return '<div class="hero-bg' + (i === 0 ? " on" : "") + '"><img src="' + m.backdrop + '" alt=""' + (i > 1 ? ' loading="lazy"' : "") + "></div>";
    }).join("");
    $("#heroDots").innerHTML = heroItems.map(function (_, i) {
      return '<button data-h="' + i + '" class="' + (i === 0 ? "on" : "") + '" aria-label="Featured ' + (i + 1) + '"></button>';
    }).join("");
    setHero(0);
    restartHeroTimer();
  }
  function setHero(i) {
    heroIdx = (i + heroItems.length) % heroItems.length;
    var m = heroItems[heroIdx];
    $$("#heroBgs .hero-bg").forEach(function (b, j) { b.classList.toggle("on", j === heroIdx); });
    $$("#heroDots button").forEach(function (d, j) { d.classList.toggle("on", j === heroIdx); });
    var match = m.rating ? Math.min(99, Math.round(m.rating * 10)) : null;
    $("#heroContent").innerHTML =
      '<div class="hero-kicker">Featured</div>' +
      '<h1 class="hero-title">' + esc(m.title) + "</h1>" +
      '<div class="hero-meta">' +
      (match ? '<span class="match">' + match + '% Match</span>' : "") +
      '<span class="rate">★ ' + (m.rating || "–") + "</span>" +
      "<span>" + (m.year || "") + "</span>" +
      "<span>" + esc((m.genres || []).slice(0, 3).join(" · ")) + "</span>" +
      "</div>" +
      '<p class="hero-overview">' + esc(m.overview || "") + "</p>" +
      '<div class="hero-actions">' +
      '<button class="btn btn-play" data-play="' + m.id + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play</button>' +
      '<button class="btn btn-ghost" data-info="' + m.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>More Info</button>' +
      "</div>";
  }
  function restartHeroTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(function () {
      if (document.hidden) return;
      setHero(heroIdx + 1);
    }, 7000);
  }
  document.addEventListener("click", function (e) {
    var d = e.target.closest("[data-h]");
    if (d) { setHero(+d.dataset.h); restartHeroTimer(); }
    var p = e.target.closest("[data-play]");
    if (p) playMovie(p.dataset.play);
    var inf = e.target.closest("[data-info]");
    if (inf) openDetail(inf.dataset.info, "movie");
  });
  $("#hero").addEventListener("mouseenter", function () { clearInterval(heroTimer); });
  $("#hero").addEventListener("mouseleave", restartHeroTimer);

  /* ---------- rows ---------- */
  function skeletonRow() {
    return '<div class="row"><div class="row-head"><div class="row-title"> </div></div>' +
      '<div class="row-scroller"><div class="row-track">' +
      new Array(8).fill('<div class="sk"></div>').join("") + "</div></div></div>";
  }
  function renderRows(rows, continueItems) {
    var html = "";
    if (continueItems && continueItems.length) {
      html += '<div class="row"><div class="row-head"><div class="row-title">Continue Watching</div></div>' +
        '<div class="row-scroller"><div class="row-track">' +
        continueItems.map(function (m) { return NM.cardHTML(m, { wide: true }); }).join("") +
        "</div>" + arrows() + "</div></div>";
    }
    rows.forEach(function (r, i) {
      html += '<div class="row"><div class="row-head"><div class="row-title">' + esc(r.title) + "</div></div>" +
        '<div class="row-scroller"><div class="row-track">' +
        r.items.map(function (m, j) { return NM.cardHTML(m, { badge: i === 0 && j < 3 ? "HOT" : "" }); }).join("") +
        "</div>" + arrows() + "</div></div>";
    });
    var el = $("#rows");
    el.innerHTML = html;
    bindCards(el);
    $$(".row-arrow", el).forEach(function (a) {
      a.addEventListener("click", function () {
        var track = a.parentElement.querySelector(".row-track");
        var dir = a.classList.contains("left") ? -1 : 1;
        track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: "smooth" });
      });
    });
  }
  function arrows() {
    return '<button class="row-arrow left" aria-label="Scroll left"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="row-arrow right" aria-label="Scroll right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></button>';
  }

  /* ---------- home load ---------- */
  var homeLoading = false;
  async function loadHome(force) {
    if (homeLoading) return;
    homeLoading = true;
    if (force || !$("#rows .row")) $("#rows").innerHTML = skeletonRow() + skeletonRow() + skeletonRow();
    renderKeyBanner();
    try {
      var rows = await NM.api.homeRows();
      var cont = NM.store.progressList();
      renderRows(rows, cont);
      var picks = await NM.api.heroPicks();
      renderHero(picks.length ? picks : rows[0].items);
    } catch (e) {
      $("#rows").innerHTML = '<div class="empty"><p>Could not load the catalog. Check your connection and try again.</p></div>';
    }
    homeLoading = false;
  }

  function renderKeyBanner() {
    var el = $("#keyBanner");
    if (NM.api.hasKey() || NM.store.keyBannerDismissed()) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="key-banner"><span>Running on the built-in collection. Add a free TMDB key for the full live catalog — trending, new releases, everything.</span>' +
      '<button class="link" id="kbOpen">Add key</button><button class="x" id="kbX" aria-label="Dismiss">×</button></div>';
    $("#kbOpen").addEventListener("click", openSettings);
    $("#kbX").addEventListener("click", function () { NM.store.dismissKeyBanner(); el.innerHTML = ""; });
  }

  /* ---------- detail modal ---------- */
  async function openDetail(id, kind) {
    kind = kind || "movie";
    var veil = $("#detailVeil"), modal = $("#detailModal");
    if (kind === "file") { playVideo(id); return; }
    veil.classList.add("on");
    modal.innerHTML = '<div class="modal-hero" style="display:grid;place-items:center;"><div class="spin on"></div></div>';
    var m = await NM.api.details(id);
    if (!m) { veil.classList.remove("on"); NM.toast("Could not load details"); return; }
    var inList = NM.store.inList(m.id);
    var prog = NM.store.getProgress(m.id);
    modal.innerHTML =
      '<div class="modal-hero">' + (m.backdrop ? '<img data-fade src="' + m.backdrop + '" alt="">' : "") +
      '<button class="modal-close" data-close="detailVeil" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="modal-body">' +
      '<h2 class="modal-title">' + esc(m.title) + "</h2>" +
      '<div class="modal-meta">' +
      (m.rating ? '<span class="match">' + Math.min(99, Math.round(m.rating * 10)) + '% Match</span><span class="rate">★ ' + m.rating + "</span>" : "") +
      "<span>" + (m.year || "") + "</span>" +
      (m.runtime ? "<span>" + m.runtime + " min</span>" : "") +
      "<span>" + esc((m.genres || []).join(", ")) + "</span>" +
      "</div>" +
      '<div class="modal-actions">' +
      '<button class="btn btn-play" data-play="' + m.id + '" style="padding:11px 24px;font-size:14px;"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' + (prog ? "Resume" : "Play") + "</button>" +
      '<button class="btn ' + (inList ? "btn-accent" : "btn-ghost") + '" data-list="' + m.id + '" style="padding:11px 24px;font-size:14px;">' + (inList ? "✓ In My List" : "+ My List") + "</button>" +
      "</div>" +
      '<p class="modal-overview">' + esc(m.overview || "No synopsis available yet.") + "</p>" +
      '<div class="modal-facts">' +
      (m.cast && m.cast.length ? "<div><b>Cast:</b> " + esc(m.cast.join(", ")) + "</div>" : "") +
      "<div><b>Genres:</b> " + esc((m.genres || []).join(", ")) + "</div>" +
      "</div>" +
      (m.similar && m.similar.length ? '<div class="sim-title">More Like This</div><div class="sim-row">' +
        m.similar.map(function (s) { return NM.cardHTML(s); }).join("") + "</div>" : "") +
      "</div>";
    bindCards(modal);
    watchImgs(modal);
    var lb = modal.querySelector("[data-list]");
    if (lb) lb.addEventListener("click", function () {
      var added = NM.store.toggleList(m);
      lb.className = "btn " + (added ? "btn-accent" : "btn-ghost");
      lb.style.cssText = "padding:11px 24px;font-size:14px;";
      lb.textContent = added ? "✓ In My List" : "+ My List";
      NM.toast(added ? "Added to My List" : "Removed from My List");
    });
  }
  $("#detailVeil").addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("on");
  });

  /* ---------- play ---------- */
  function playMovie(id) {
    $("#detailVeil").classList.remove("on");
    location.href = "player.html?type=trailer&id=" + encodeURIComponent(id);
  }
  function playVideo(vidId) {
    location.href = "player.html?type=file&vid=" + encodeURIComponent(vidId);
  }
  NM.playMovie = playMovie;

  /* ---------- search ---------- */
  var searchT = null;
  $("#searchInput").addEventListener("input", function (e) {
    clearTimeout(searchT);
    var q = e.target.value;
    searchT = setTimeout(function () { runSearch(q); }, 350);
  });
  async function runSearch(q) {
    var grid = $("#searchGrid"), empty = $("#searchEmpty");
    if (!q.trim()) { grid.innerHTML = ""; empty.style.display = ""; empty.querySelector("p").textContent = "Type something to start searching."; return; }
    empty.style.display = "none";
    grid.innerHTML = new Array(8).fill('<div class="sk"></div>').join("");
    var items = await NM.api.search(q);
    if (!items.length) {
      grid.innerHTML = "";
      empty.style.display = "";
      empty.querySelector("p").textContent = 'No results for "' + q + '".';
      return;
    }
    grid.innerHTML = items.map(function (m) { return NM.cardHTML(m); }).join("");
    bindCards(grid);
  }

  /* ---------- my list ---------- */
  function renderList() {
    var list = NM.store.list();
    $("#listGrid").innerHTML = list.map(function (m) { return NM.cardHTML(m); }).join("");
    $("#listEmpty").style.display = list.length ? "none" : "";
    bindCards($("#listGrid"));
  }

  /* ---------- my videos ---------- */
  function renderVideos() {
    var vids = NM.store.videos();
    var el = $("#vidList");
    el.innerHTML = vids.map(function (v) {
      return '<div class="vid-row"><button class="play" data-vplay="' + v.id + '" aria-label="Play"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></button>' +
        '<div class="nm">' + esc(v.title) + '</div><button class="del" data-vdel="' + v.id + '" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6"/></svg></button></div>';
    }).join("");
    $("#vidEmpty").style.display = vids.length ? "none" : "";
  }
  document.addEventListener("click", function (e) {
    var p = e.target.closest("[data-vplay]");
    if (p) { playVideo(p.dataset.vplay); return; }
    var d = e.target.closest("[data-vdel]");
    if (d) { NM.store.removeVideo(d.dataset.vdel); renderVideos(); NM.toast("Video removed"); }
  });
  $("#vidAdd").addEventListener("click", function () {
    var url = $("#vidUrl").value.trim(), title = $("#vidTitle").value.trim();
    if (!url) { NM.toast("Paste a video link first"); return; }
    var v = NM.store.addVideo(title || url.split("/").pop(), url);
    $("#vidUrl").value = ""; $("#vidTitle").value = "";
    renderVideos();
    NM.toast("Video added — tap play to watch");
    void v;
  });
  $("#vidFile").addEventListener("click", function () { $("#vidFileInput").click(); });
  $("#vidFileInput").addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f);
    var v = NM.store.addVideo(f.name.replace(/\.[^.]+$/, ""), url);
    // mark session-only so a reload doesn't keep a dead blob URL
    try {
      var vids = NM.store.videos();
      var rec = vids.find(function (x) { return x.id === v.id; });
      if (rec) { rec.session = true; localStorage.setItem("nm_videos", JSON.stringify(vids)); }
    } catch (err) {}
    renderVideos();
    NM.toast("File ready — tap play");
    e.target.value = "";
  });

  /* ---------- settings ---------- */
  function openSettings() {
    $("#tmdbKey").value = NM.getKey();
    renderChips();
    $("#settingsVeil").classList.add("on");
  }
  $("#saveSettings").addEventListener("click", function () {
    NM.setKey($("#tmdbKey").value);
    $("#settingsVeil").classList.remove("on");
    NM.toast(NM.hasKey() ? "Key saved — full catalog unlocked" : "Key removed — using built-in collection");
    loadHome(true);
  });

  /* ---------- boot ---------- */
  renderChips();
  loadHome(false);
  // refresh continue-watching when returning from the player
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && currentView === "home") loadHome(false);
  });
})();
