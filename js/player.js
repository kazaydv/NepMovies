/* NepMovies — cinematic player. YouTube trailers + own files, one smooth UI. */
(function () {
  "use strict";
  var NM = window.NM;
  var $ = function (s) { return document.querySelector(s); };

  var ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  var qs = new URLSearchParams(location.search);
  var type = qs.get("type") || "trailer";
  var movie = null;      // normalized movie object
  var fileUrl = null;

  /* ================= driver abstraction ================= */
  var driver = null; // {play,pause,seekTo,getTime,getDur,isPlaying,setVol,getVol,setRate,onTick,onState}
  var ytPlayer = null, nativeVideo = null;
  var state = { playing: false, t: 0, d: 0, ended: false, started: false };
  var resumeFrom = 0;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(sec).padStart(2, "0");
  }

  /* ================= UI wiring ================= */
  var stage = $("#stage"), hideT = null;
  function showControls() {
    stage.classList.add("controls");
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      if (state.playing) stage.classList.remove("controls");
    }, 3200);
  }
  ["mousemove", "touchstart"].forEach(function (ev) {
    stage.addEventListener(ev, showControls, { passive: true });
  });

  function setPlayIcon() {
    $("#playBtn").innerHTML = state.playing ? ICONS.pause : (state.ended ? ICONS.replay : ICONS.play);
  }
  function flashCenter(icon) {
    var el = $("#centerState");
    el.innerHTML = icon;
    el.classList.add("on");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("on"); }, 550);
  }
  function setSpin(on) { $("#spin").classList.toggle("on", on); }

  $("#playBtn").addEventListener("click", togglePlay);
  function togglePlay() {
    if (!driver) return;
    if (state.ended) { driver.seekTo(0); state.ended = false; }
    if (state.playing) { driver.pause(); } else { driver.play(); hideResume(); }
    showControls();
  }
  function flashTap(el) {
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    setTimeout(function () { el.classList.remove("flash"); }, 500);
  }
  $("#rwBtn").addEventListener("click", function () { seekRel(-10); flashTap($("#tapL")); });
  $("#ffBtn").addEventListener("click", function () { seekRel(10); flashTap($("#tapR")); });
  function seekRel(d) {
    if (!driver) return;
    driver.seekTo(Math.min(Math.max(0, state.t + d), state.d || Infinity));
    state.ended = false; setPlayIcon(); showControls();
  }

  /* stage tap logic: single = toggle controls, double = fullscreen, sides = ±10s */
  var lastTap = 0, tapTimer = null;
  stage.addEventListener("click", function (e) {
    if (e.target.closest(".pctrl") || e.target.closest(".ptop") || e.target.closest(".pselect") || e.target.closest("#resumeSlot") || e.target.closest("#errSlot")) return;
    var now = Date.now();
    var x = e.clientX / window.innerWidth;
    if (now - lastTap < 320) {
      clearTimeout(tapTimer); lastTap = 0;
      if (x < 0.32) { seekRel(-10); flashTap($("#tapL")); }
      else if (x > 0.68) { seekRel(10); flashTap($("#tapR")); }
      else toggleFullscreen();
      return;
    }
    lastTap = now;
    tapTimer = setTimeout(function () {
      lastTap = 0;
      if (stage.classList.contains("controls")) stage.classList.remove("controls");
      else showControls();
    }, 330);
  });

  /* seekbar */
  var seeking = false;
  var seekEl = $("#seek");
  function seekRatio(e) {
    var r = seekEl.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.min(1, Math.max(0, x / r.width));
  }
  function seekStart(e) { seeking = true; seekMove(e); }
  function seekMove(e) {
    if (!seeking || !state.d) return;
    var ratio = seekRatio(e);
    var t = ratio * state.d;
    $("#seekFill").style.width = ratio * 100 + "%";
    $("#seekKnob").style.left = ratio * 100 + "%";
    var prev = $("#seekPrev");
    prev.style.left = Math.min(96, Math.max(4, ratio * 100)) + "%";
    prev.textContent = fmt(t);
    if (e.cancelable) e.preventDefault();
  }
  function seekEnd(e) {
    if (!seeking) return;
    seeking = false;
    if (driver && state.d) { driver.seekTo(seekRatio(e) * state.d); state.ended = false; setPlayIcon(); }
    showControls();
  }
  seekEl.addEventListener("mousedown", seekStart);
  window.addEventListener("mousemove", seekMove);
  window.addEventListener("mouseup", seekEnd);
  seekEl.addEventListener("touchstart", seekStart, { passive: false });
  seekEl.addEventListener("touchmove", seekMove, { passive: false });
  seekEl.addEventListener("touchend", seekEnd);

  /* volume */
  function renderMute() { $("#muteBtn").innerHTML = (driver && driver.getVol() === 0) ? ICONS.mute : ICONS.vol; }
  $("#muteBtn").addEventListener("click", function () {
    if (!driver) return;
    driver.setVol(driver.getVol() === 0 ? 100 : 0);
    $("#volRange").value = driver.getVol();
    renderMute(); showControls();
  });
  $("#volRange").addEventListener("input", function (e) {
    if (driver) driver.setVol(+e.target.value);
    renderMute(); showControls();
  });

  /* speed */
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var curSpeed = 1;
  $("#speedMenu").innerHTML = SPEEDS.map(function (s) {
    return '<button data-sp="' + s + '" class="' + (s === 1 ? "sel" : "") + '">' + s + "x</button>";
  }).join("");
  $("#speedBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    $("#speedMenu").classList.toggle("on");
    showControls();
  });
  document.addEventListener("click", function () { $("#speedMenu").classList.remove("on"); });
  $("#speedMenu").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sp]");
    if (!b || !driver) return;
    curSpeed = +b.dataset.sp;
    driver.setRate(curSpeed);
    $("#speedBtn").textContent = (curSpeed + "x").replace(".0x", "x");
    $$("#speedMenu button").forEach(function (x) { x.classList.toggle("sel", +x.dataset.sp === curSpeed); });
    showControls();
  });
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* fullscreen */
  function toggleFullscreen() {
    var el = $("#playerPage");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
    showControls();
  }
  $("#fsBtn").addEventListener("click", toggleFullscreen);
  $("#backBtn").addEventListener("click", function () { history.back(); });

  /* keyboard */
  document.addEventListener("keydown", function (e) {
    if (!driver) return;
    if (e.key === " " || e.key.toLowerCase() === "k") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowRight") seekRel(10);
    else if (e.key === "ArrowLeft") seekRel(-10);
    else if (e.key.toLowerCase() === "f") toggleFullscreen();
    else if (e.key.toLowerCase() === "m") $("#muteBtn").click();
    else if (e.key === "Escape" && !document.fullscreenElement) history.back();
  });

  /* tick → UI */
  function tick() {
    if (!driver || seeking) return;
    state.t = driver.getTime();
    state.d = driver.getDur();
    if (state.d > 0) {
      var r = state.t / state.d;
      $("#seekFill").style.width = r * 100 + "%";
      $("#seekKnob").style.left = r * 100 + "%";
      $("#timeLabel").textContent = fmt(state.t) + " / " + fmt(state.d);
    }
    var buf = driver.getBuffered ? driver.getBuffered() : 0;
    if (state.d > 0) $("#seekBuf").style.width = Math.min(100, buf / state.d * 100) + "%";
  }
  setInterval(tick, 400);

  /* progress persistence */
  setInterval(function () {
    if (movie && state.playing && state.d > 0) NM.store.saveProgress(movie, state.t, state.d);
  }, 5000);
  window.addEventListener("pagehide", function () {
    if (movie && state.d > 0) NM.store.saveProgress(movie, state.t, state.d);
  });

  /* resume prompt */
  function maybeResume() {
    var p = NM.store.getProgress(movie.id);
    if (!p || !p.t) return false;
    resumeFrom = p.t;
    $("#resumeSlot").innerHTML =
      '<div class="resume-veil"><div class="resume-card"><h3>Resume watching?</h3>' +
      "<p>You left off at <b>" + fmt(p.t) + "</b> of " + fmt(p.d) + ".</p>" +
      '<div class="row" style="margin:0"><button class="btn btn-play" id="rsYes" style="padding:11px 26px;font-size:14px;">Resume</button>' +
      '<button class="btn btn-ghost" id="rsNo" style="padding:11px 26px;font-size:14px;">Start over</button></div>' +
      "</div></div>";
    $("#rsYes").addEventListener("click", function () { driver.seekTo(resumeFrom); hideResume(); driver.play(); });
    $("#rsNo").addEventListener("click", function () { hideResume(); driver.play(); });
    return true;
  }
  function hideResume() { $("#resumeSlot").innerHTML = ""; }

  function showError(title, msg) {
    $("#errSlot").innerHTML = '<div class="perr"><div><h3>' + title + "</h3><p>" + msg + '</p>' +
      '<button class="btn btn-ghost" onclick="history.back()">Go back</button></div></div>';
    setSpin(false);
  }

  /* ================= YOUTUBE driver ================= */
  function initYouTube(trailerId) {
    setSpin(true);
    // NOTE: YT.Player REPLACES the target div with an iframe (the class is lost),
    // so the sizing class must live on a wrapper that survives.
    var wrap = document.createElement("div");
    wrap.className = "yt-wrap";
    var holder = document.createElement("div");
    wrap.appendChild(holder);
    stage.insertBefore(wrap, stage.firstChild);
    function make() {
      ytPlayer = new YT.Player(holder, {
        videoId: trailerId,
        playerVars: { controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, disablekb: 1, playsinline: 1, fs: 0 },
        events: {
          onReady: function () {
            driver = {
              play: function () { ytPlayer.playVideo(); },
              pause: function () { ytPlayer.pauseVideo(); },
              seekTo: function (s) { ytPlayer.seekTo(s, true); },
              getTime: function () { try { return ytPlayer.getCurrentTime() || 0; } catch (e) { return 0; } },
              getDur: function () { try { return ytPlayer.getDuration() || 0; } catch (e) { return 0; } },
              isPlaying: function () { try { return ytPlayer.getPlayerState() === YT.PlayerState.PLAYING; } catch (e) { return false; } },
              setVol: function (v) { v ? ytPlayer.unMute() : ytPlayer.mute(); ytPlayer.setVolume(v); },
              getVol: function () { try { return ytPlayer.isMuted() ? 0 : ytPlayer.getVolume(); } catch (e) { return 100; } },
              setRate: function (r) { ytPlayer.setPlaybackRate(r); },
              getBuffered: function () { try { return ytPlayer.getVideoLoadedFraction() * (ytPlayer.getDuration() || 0); } catch (e) { return 0; } },
            };
            $("#volRange").value = 100;
            renderMute(); setPlayIcon(); showControls();
            var hadResume = maybeResume();
            if (!hadResume) ytPlayer.playVideo();
          },
          onStateChange: function (ev) {
            var S = YT.PlayerState;
            if (ev.data === S.PLAYING) { state.playing = true; state.ended = false; state.started = true; setSpin(false); flashCenter(ICONS.play); }
            else if (ev.data === S.PAUSED) { state.playing = false; setSpin(false); flashCenter(ICONS.pause); }
            else if (ev.data === S.BUFFERING) { if (state.started) setSpin(true); }
            else if (ev.data === S.ENDED) {
              state.playing = false; state.ended = true; setSpin(false);
              NM.store.clearProgress(movie.id); setPlayIcon(); showControls();
            }
            setPlayIcon(); tick(); showControls();
          },
          onError: function () { showError("This trailer can't be embedded", "The owner disabled embedding for this video. Try another title — most trailers play fine."); },
        },
      });
    }
    if (window.YT && window.YT.Player) make();
    else {
      var tries = 0;
      var iv = setInterval(function () {
        if (window.YT && window.YT.Player) { clearInterval(iv); make(); }
        else if (++tries > 60) { clearInterval(iv); showError("Player failed to load", "Check your connection and reload the page."); }
      }, 250);
    }
  }

  /* ================= native file driver ================= */
  function initNative(url) {
    var v = document.createElement("video");
    v.src = url;
    v.playsInline = true;
    v.preload = "auto";
    stage.insertBefore(v, stage.firstChild);
    nativeVideo = v;
    setSpin(true);
    driver = {
      play: function () { v.play(); },
      pause: function () { v.pause(); },
      seekTo: function (s) { v.currentTime = s; },
      getTime: function () { return v.currentTime || 0; },
      getDur: function () { return v.duration || 0; },
      isPlaying: function () { return !v.paused; },
      setVol: function (val) { v.muted = false; v.volume = val / 100; },
      getVol: function () { return v.muted ? 0 : Math.round(v.volume * 100); },
      setRate: function (r) { v.playbackRate = r; },
      getBuffered: function () {
        try {
          if (v.buffered.length) return v.buffered.end(v.buffered.length - 1);
        } catch (e) {}
        return 0;
      },
    };
    v.addEventListener("loadedmetadata", function () {
      setSpin(false); renderMute(); setPlayIcon(); showControls();
      var hadResume = maybeResume();
      if (!hadResume) v.play();
    });
    v.addEventListener("play", function () { state.playing = true; setPlayIcon(); showControls(); });
    v.addEventListener("pause", function () { state.playing = false; setPlayIcon(); showControls(); });
    v.addEventListener("waiting", function () { setSpin(true); });
    v.addEventListener("playing", function () { setSpin(false); });
    v.addEventListener("ended", function () {
      state.playing = false; state.ended = true;
      NM.store.clearProgress(movie.id); setPlayIcon(); showControls();
    });
    v.addEventListener("error", function () {
      showError("Couldn't play this video", "The link may be dead, blocked, or not a direct video file. Try a direct .mp4 link.");
    });
    $("#volRange").value = 100;
  }

  /* ================= boot ================= */
  async function boot() {
    setPlayIcon(); renderMute();
    if (type === "file") {
      var vidId = qs.get("vid");
      var rec = NM.store.videos().find(function (x) { return x.id === vidId; });
      if (!rec) { showError("Video not found", "It may have been removed. Files picked from your device only last for this session."); return; }
      movie = { id: rec.id, title: rec.title, kind: "file", url: rec.url, poster: "", backdrop: "" };
      fileUrl = rec.url;
      $("#pTitle").textContent = rec.title;
      $("#pSub").textContent = "My video";
      document.title = rec.title + " — NepMovies";
      initNative(fileUrl);
      return;
    }
    // trailer mode
    var id = qs.get("id");
    if (!id) { showError("Nothing to play", "No movie was selected."); return; }
    $("#pTitle").textContent = "Loading…";
    var m = await NM.api.details(id);
    if (!m) { showError("Couldn't load this title", "Check your connection and try again."); return; }
    movie = m;
    $("#pTitle").textContent = m.title;
    $("#pSub").textContent = [m.year, (m.genres || []).slice(0, 2).join(" · ")].filter(Boolean).join("  ·  ");
    document.title = m.title + " — NepMovies";
    if (m.backdrop) $("#ambient").innerHTML = '<img src="' + m.backdrop + '" alt="">';
    if (!m.trailer) { showError("No trailer available", "We couldn't find a playable trailer for this title right now."); return; }
    initYouTube(m.trailer);
  }

  boot();
})();
