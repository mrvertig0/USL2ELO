(function () {
  "use strict";

  var boardBody = document.getElementById("board-body");
  var searchInput = document.getElementById("search");
  var metaLine = document.getElementById("meta-line");
  var footerUpdated = document.getElementById("footer-updated");
  var heroNum = document.getElementById("hero-num");
  var heroTeamName = document.getElementById("hero-team-name");
  var heroTeamRecord = document.getElementById("hero-team-record");
  var heroNote = document.getElementById("hero-note");
  var leagueTabs = document.getElementById("league-tabs");
  var seasonToggle = document.getElementById("season-toggle");
  var moversSection = document.getElementById("movers-section");
  var moversUp = document.getElementById("movers-up");
  var moversDown = document.getElementById("movers-down");
  var modalOverlay = document.getElementById("modal-overlay");
  var modalClose = document.getElementById("modal-close");
  var modalTeamName = document.getElementById("modal-team-name");
  var modalTeamSub = document.getElementById("modal-team-sub");
  var modalChartWrap = document.getElementById("modal-chart-wrap");
  var compareOpenBtn = document.getElementById("compare-open");
  var compareOverlay = document.getElementById("compare-overlay");
  var compareClose = document.getElementById("compare-close");
  var compareTeamA = document.getElementById("compare-team-a");
  var compareTeamB = document.getElementById("compare-team-b");
  var compareEmpty = document.getElementById("compare-empty");
  var compareBody = document.getElementById("compare-body");
  var compareH2h = document.getElementById("compare-h2h");
  var compareChartWrap = document.getElementById("compare-chart-wrap");
  var compareVenueToggle = document.getElementById("compare-venue-toggle");
  var compareOddsGrid = document.getElementById("compare-odds-grid");
  var compareVenue = "neutral";

  var LEAGUES = {
    usl2: {
      label: "USL League Two",
      allTimeNote: "Every result since the league's post-PDL rebrand, folded into one running rating. Recalculated after every update.",
    },
    wleague: {
      label: "USL W League",
      allTimeNote: "Every result since the league launched, folded into one running rating. Recalculated after every update.",
    },
    champ: {
      label: "USL Championship",
      allTimeNote: "Every result since the league's modern Championship branding, folded into one running rating. Recalculated after every update.",
    },
    l1: {
      label: "USL League One",
      allTimeNote: "Every result since the league launched in 2019, folded into one running rating. Recalculated after every update.",
    },
    superleague: {
      label: "USL Super League",
      allTimeNote: "Every result since the league launched, folded into one running rating. Recalculated after every update.",
    },
  };

  // datasets[league][scope] = { ratings, teams, history }
  var datasets = { usl2: {}, wleague: {}, champ: {}, l1: {}, superleague: {} };
  var activeLeague = "usl2";
  var activeScope = "all_time";

  function fmtDate(iso) {
    if (!iso) return "unknown";
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildSvgPath(points, w, h, pad) {
    var vals = points.map(function (p) { return p.rating; });
    if (vals.length < 2) return null;
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var last = vals.length - 1;
    var coords = vals.map(function (v, i) {
      var x = pad + (i / last) * (w - 2 * pad);
      var y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var trendUp = vals[vals.length - 1] >= vals[0];
    return { coords: coords.join(" "), trendUp: trendUp };
  }

  function sparkline(points) {
    var w = 72, h = 26, pad = 3;
    var built = buildSvgPath(points, w, h, pad);
    if (!built) return "";
    var stroke = built.trendUp ? "var(--up)" : "var(--down)";
    return (
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" ' +
      'preserveAspectRatio="none" role="img" aria-label="rating trend">' +
      '<polyline fill="none" stroke="' + stroke + '" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" points="' + built.coords + '"/>' +
      "</svg>"
    );
  }

  function bigChart(points) {
    var w = 640, h = 260, pad = 28;
    var built = buildSvgPath(points, w, h, pad);
    if (!built) {
      return '<p class="modal-empty">Not enough matches yet for a chart.</p>';
    }
    var vals = points.map(function (p) { return p.rating; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var stroke = built.trendUp ? "var(--up)" : "var(--down)";

    var mid = (min + max) / 2;
    var gridVals = [min, mid, max];
    var gridLines = gridVals.map(function (v) {
      var y = h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
      return (
        '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + y.toFixed(1) + '" ' +
        'stroke="rgba(20,35,29,0.1)" stroke-width="1"/>' +
        '<text x="' + (pad - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" ' +
        'font-family="var(--mono)" font-size="11" fill="rgba(20,35,29,0.5)">' + v.toFixed(0) + "</text>"
      );
    }).join("");

    var firstDate = points[1] && points[1].t ? new Date(points[1].t * 1000) : null;
    var lastPoint = points[points.length - 1];
    var lastDate = lastPoint && lastPoint.t ? new Date(lastPoint.t * 1000) : null;
    var dateLabels = "";
    if (firstDate && lastDate) {
      dateLabels =
        '<text x="' + pad + '" y="' + (h - 6) + '" font-family="var(--mono)" font-size="11" ' +
        'fill="rgba(20,35,29,0.5)">' + firstDate.toLocaleDateString(undefined, { year: "numeric", month: "short" }) + "</text>" +
        '<text x="' + (w - pad) + '" y="' + (h - 6) + '" text-anchor="end" font-family="var(--mono)" font-size="11" ' +
        'fill="rgba(20,35,29,0.5)">' + lastDate.toLocaleDateString(undefined, { year: "numeric", month: "short" }) + "</text>";
    }

    return (
      '<svg width="100%" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Full rating history">' +
      gridLines +
      '<polyline fill="none" stroke="' + stroke + '" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" points="' + built.coords + '"/>' +
      dateLabels +
      "</svg>"
    );
  }

  function openModal(team, history) {
    modalTeamName.textContent = team.team;
    modalTeamSub.textContent = team.wins + "W " + team.draws + "D " + team.losses + "L \u00b7 " +
      team.games_played + " matches \u00b7 current rating " + team.rating.toFixed(1);
    modalChartWrap.innerHTML = bigChart(history);
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });

  function renderRow(team, historyByTeam) {
    var tr = document.createElement("tr");
    var hist = historyByTeam[String(team.team_id)] || [];
    tr.innerHTML =
      '<td class="col-rank">' + team.rank + "</td>" +
      '<td class="col-team">' + escapeHtml(team.team) + "</td>" +
      '<td class="col-form"><button type="button" class="spark-btn" aria-label="View full rating history for ' +
        escapeHtml(team.team) + '">' + sparkline(hist) + "</button></td>" +
      '<td class="col-rating">' + team.rating.toFixed(1) + "</td>" +
      '<td class="col-record">' + team.games_played + "</td>" +
      '<td class="col-record">' + team.wins + "</td>" +
      '<td class="col-record">' + team.draws + "</td>" +
      '<td class="col-record">' + team.losses + "</td>";
    tr.dataset.name = team.team.toLowerCase();
    tr.querySelector(".spark-btn").addEventListener("click", function () {
      openModal(team, hist);
    });
    return tr;
  }

  function renderBoard(teams, historyByTeam) {
    boardBody.innerHTML = "";
    if (!teams.length) {
      boardBody.innerHTML = '<tr><td colspan="8" class="empty-row">No clubs match that search.</td></tr>';
      return;
    }
    var frag = document.createDocumentFragment();
    teams.forEach(function (t) { frag.appendChild(renderRow(t, historyByTeam)); });
    boardBody.appendChild(frag);
  }

  function renderMovers(teams) {
    var eligible = teams.filter(function (t) { return t.delta_recent_games >= 2; });
    var up = eligible.slice().sort(function (a, b) { return b.delta_recent - a.delta_recent; }).slice(0, 5)
      .filter(function (t) { return t.delta_recent > 0; });
    var down = eligible.slice().sort(function (a, b) { return a.delta_recent - b.delta_recent; }).slice(0, 5)
      .filter(function (t) { return t.delta_recent < 0; });

    if (!up.length && !down.length) {
      moversSection.hidden = true;
      return;
    }
    moversSection.hidden = false;

    function renderList(el, list, sign) {
      el.innerHTML = "";
      if (!list.length) {
        el.innerHTML = '<li class="movers-empty">Not enough recent matches yet.</li>';
        return;
      }
      list.forEach(function (t) {
        var li = document.createElement("li");
        li.className = "movers-item";
        var deltaStr = (sign > 0 ? "+" : "") + t.delta_recent.toFixed(1);
        li.innerHTML =
          '<span class="movers-name">' + escapeHtml(t.team) + "</span>" +
          '<span class="movers-delta ' + (sign > 0 ? "up" : "down") + '">' + deltaStr + "</span>";
        el.appendChild(li);
      });
    }

    renderList(moversUp, up, 1);
    renderList(moversDown, down, -1);
  }

  function applyFilter() {
    var ds = datasets[activeLeague][activeScope];
    if (!ds) return;
    var q = searchInput.value.trim().toLowerCase();
    var teams = q ? ds.teams.filter(function (t) { return t.team.toLowerCase().indexOf(q) !== -1; }) : ds.teams;
    renderBoard(teams, ds.history);
  }

  searchInput.addEventListener("input", applyFilter);

  function render() {
    var ds = datasets[activeLeague][activeScope];
    if (!ds) {
      boardBody.innerHTML = '<tr><td colspan="8" class="empty-row">No data yet for this view.</td></tr>';
      metaLine.textContent = "";
      heroTeamName.textContent = "No data yet";
      heroNum.textContent = "\u2014";
      moversSection.hidden = true;
      return;
    }

    metaLine.textContent = ds.teams.length + " clubs \u00b7 " + ds.ratings.matches_used + " matches" +
      (activeScope === "season" && ds.ratings.season_year ? " \u00b7 " + ds.ratings.season_year + " season" : " \u00b7 all-time");
    footerUpdated.textContent = "ratings last computed " + fmtDate(ds.ratings.generated_at_utc) +
      (ds.ratings.data_fetched_at_utc ? " \u00b7 data pulled " + fmtDate(ds.ratings.data_fetched_at_utc) : "");

    if (ds.teams.length) {
      var top = ds.teams[0];
      heroNum.textContent = top.rating.toFixed(0);
      heroTeamName.textContent = top.team;
      heroTeamRecord.textContent = top.wins + "W " + top.draws + "D " + top.losses + "L";
    }

    heroNote.textContent = activeScope === "season"
      ? "Reset to a level field at the start of " + (ds.ratings.season_year || "this season") + " and rebuilt from just this season's results."
      : LEAGUES[activeLeague].allTimeNote;

    renderMovers(ds.teams);
    applyFilter();
  }

  leagueTabs.addEventListener("click", function (e) {
    var btn = e.target.closest(".league-tab");
    if (!btn) return;
    var league = btn.dataset.league;
    if (league === activeLeague) return;
    activeLeague = league;
    document.body.dataset.league = league;
    Array.prototype.forEach.call(leagueTabs.querySelectorAll(".league-tab"), function (b) {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    render();
  });

  seasonToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    var scope = btn.dataset.scope;
    activeScope = scope;
    Array.prototype.forEach.call(seasonToggle.querySelectorAll(".seg-btn"), function (b) {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    render();
  });

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }

  // ---------- Compare Clubs ----------

  function populateCompareSelects() {
    var ds = datasets[activeLeague].all_time;
    var teams = ds ? ds.teams.slice().sort(function (a, b) { return a.team.localeCompare(b.team); }) : [];
    [compareTeamA, compareTeamB].forEach(function (sel) {
      var current = sel.value;
      sel.innerHTML = '<option value="">Pick a club&hellip;</option>';
      teams.forEach(function (t) {
        var opt = document.createElement("option");
        opt.value = t.team_id;
        opt.textContent = t.team;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    });
  }

  function openCompare() {
    populateCompareSelects();
    compareOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCompare() {
    compareOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  compareOpenBtn.addEventListener("click", openCompare);
  compareClose.addEventListener("click", closeCompare);
  compareOverlay.addEventListener("click", function (e) {
    if (e.target === compareOverlay) closeCompare();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !compareOverlay.hidden) closeCompare();
  });

  function probToAmerican(p) {
    if (p <= 0 || p >= 1) return "\u2014";
    var am = p >= 0.5 ? -100 * p / (1 - p) : 100 * (1 - p) / p;
    var rounded = Math.round(am);
    return (rounded > 0 ? "+" : "") + rounded;
  }

  function computeOdds(ratingA, ratingB, homeAdv, drawRate, venue) {
    var adv = venue === "a" ? homeAdv : venue === "b" ? -homeAdv : 0;
    var dr = (ratingA + adv) - ratingB;
    var eA = 1 / (1 + Math.pow(10, -dr / 400));
    var pDraw = drawRate * Math.exp(-Math.pow(dr / 400, 2));
    var remaining = 1 - pDraw;
    var pA = remaining * eA;
    var pB = remaining * (1 - eA);
    return { pA: pA, pDraw: pDraw, pB: pB };
  }

  function renderCompareOdds(teamA, teamB, ratingsMeta) {
    var homeAdv = ratingsMeta.home_advantage || 60;
    var drawRate = ratingsMeta.league_draw_rate != null ? ratingsMeta.league_draw_rate : 0.24;
    var odds = computeOdds(teamA.rating, teamB.rating, homeAdv, drawRate, compareVenue);

    function card(name, p) {
      return (
        '<div class="compare-odds-card">' +
        '<div class="compare-odds-name">' + escapeHtml(name) + "</div>" +
        '<div class="compare-odds-pct">' + (p * 100).toFixed(0) + "%</div>" +
        '<div class="compare-odds-american">' + probToAmerican(p) + "</div>" +
        "</div>"
      );
    }

    compareOddsGrid.innerHTML =
      card(teamA.team, odds.pA) +
      card("Draw", odds.pDraw) +
      card(teamB.team, odds.pB);
  }

  function renderCompareChart(teamA, teamB, historyA, historyB) {
    var w = 640, h = 260, pad = 28;
    var seriesA = historyA.filter(function (p) { return p.t != null; });
    var seriesB = historyB.filter(function (p) { return p.t != null; });
    if (seriesA.length < 2 && seriesB.length < 2) {
      compareChartWrap.innerHTML = '<p class="modal-empty">Not enough matches yet for a chart.</p>';
      return;
    }
    var allPoints = seriesA.concat(seriesB);
    var allT = allPoints.map(function (p) { return p.t; });
    var allR = allPoints.map(function (p) { return p.rating; });
    var minT = Math.min.apply(null, allT), maxT = Math.max.apply(null, allT);
    var minR = Math.min.apply(null, allR), maxR = Math.max.apply(null, allR);
    var tRange = (maxT - minT) || 1;
    var rRange = (maxR - minR) || 1;

    function toPoints(series) {
      return series.map(function (p) {
        var x = pad + ((p.t - minT) / tRange) * (w - 2 * pad);
        var y = h - pad - ((p.rating - minR) / rRange) * (h - 2 * pad);
        return x.toFixed(1) + "," + y.toFixed(1);
      }).join(" ");
    }

    var colorA = "#4f9d6e";
    var colorB = "#8b5fbf";

    var gridVals = [minR, (minR + maxR) / 2, maxR];
    var gridLines = gridVals.map(function (v) {
      var y = h - pad - ((v - minR) / rRange) * (h - 2 * pad);
      return (
        '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + y.toFixed(1) + '" ' +
        'stroke="rgba(20,35,29,0.1)" stroke-width="1"/>' +
        '<text x="' + (pad - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" ' +
        'font-family="var(--mono)" font-size="11" fill="rgba(20,35,29,0.5)">' + v.toFixed(0) + "</text>"
      );
    }).join("");

    var svg =
      '<div class="compare-legend">' +
      '<span class="compare-legend-item"><span class="compare-legend-swatch" style="background:' + colorA + '"></span>' + escapeHtml(teamA.team) + "</span>" +
      '<span class="compare-legend-item"><span class="compare-legend-swatch" style="background:' + colorB + '"></span>' + escapeHtml(teamB.team) + "</span>" +
      "</div>" +
      '<svg width="100%" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rating history comparison">' +
      gridLines +
      (seriesA.length >= 2 ? '<polyline fill="none" stroke="' + colorA + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="' + toPoints(seriesA) + '"/>' : "") +
      (seriesB.length >= 2 ? '<polyline fill="none" stroke="' + colorB + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="' + toPoints(seriesB) + '"/>' : "") +
      "</svg>";
    compareChartWrap.innerHTML = svg;
  }

  function renderCompareH2H(teamA, teamB) {
    var matches = datasets[activeLeague].matches || [];
    var meetings = matches.filter(function (m) {
      return (m.h === teamA.team_id && m.a === teamB.team_id) || (m.h === teamB.team_id && m.a === teamA.team_id);
    }).sort(function (x, y) { return (y.t || 0) - (x.t || 0); });

    var winsA = 0, winsB = 0, draws = 0;
    meetings.forEach(function (m) {
      var aIsHome = m.h === teamA.team_id;
      var aScore = aIsHome ? m.hs : m.as;
      var bScore = aIsHome ? m.as : m.hs;
      if (aScore > bScore) winsA++;
      else if (bScore > aScore) winsB++;
      else draws++;
    });

    if (!meetings.length) {
      compareH2h.innerHTML =
        '<div class="compare-h2h-record">No meetings yet</div>' +
        '<div class="compare-h2h-sub">' + escapeHtml(teamA.team) + " and " + escapeHtml(teamB.team) + " haven't played each other.</div>";
      return;
    }

    var listHtml = meetings.slice(0, 15).map(function (m) {
      var date = m.t ? new Date(m.t * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
      var homeIsA = m.h === teamA.team_id;
      var line = (homeIsA ? teamA.team : teamB.team) + " " + m.hs + "\u2013" + m.as + " " + (homeIsA ? teamB.team : teamA.team);
      return "<li><span>" + escapeHtml(date) + "</span><span>" + escapeHtml(line) + "</span></li>";
    }).join("");

    compareH2h.innerHTML =
      '<div class="compare-h2h-record">' + winsA + "\u2013" + draws + "\u2013" + winsB + "</div>" +
      '<div class="compare-h2h-sub">' + escapeHtml(teamA.team) + " wins \u2013 draws \u2013 " + escapeHtml(teamB.team) + " wins, " +
      meetings.length + " all-time meeting" + (meetings.length === 1 ? "" : "s") + "</div>" +
      '<ul class="compare-h2h-list">' + listHtml + "</ul>";
  }

  function renderCompare() {
    var aId = compareTeamA.value, bId = compareTeamB.value;
    if (!aId || !bId || aId === bId) {
      compareEmpty.hidden = false;
      compareBody.hidden = true;
      return;
    }
    var ds = datasets[activeLeague].all_time;
    if (!ds) return;
    var teamA = ds.teams.find(function (t) { return String(t.team_id) === aId; });
    var teamB = ds.teams.find(function (t) { return String(t.team_id) === bId; });
    if (!teamA || !teamB) return;

    compareEmpty.hidden = true;
    compareBody.hidden = false;

    renderCompareH2H(teamA, teamB);
    renderCompareChart(teamA, teamB, ds.history[String(teamA.team_id)] || [], ds.history[String(teamB.team_id)] || []);
    renderCompareOdds(teamA, teamB, ds.ratings);
  }

  compareTeamA.addEventListener("change", renderCompare);
  compareTeamB.addEventListener("change", renderCompare);

  compareVenueToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    compareVenue = btn.dataset.venue;
    Array.prototype.forEach.call(compareVenueToggle.querySelectorAll(".seg-btn"), function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    renderCompare();
  });

  function loadLeague(key) {
    return Promise.all([
      loadJson("data/ratings_" + key + ".json").catch(function () { return null; }),
      loadJson("data/history_" + key + ".json").catch(function () { return {}; }),
      loadJson("data/ratings_" + key + "_season.json").catch(function () { return null; }),
      loadJson("data/history_" + key + "_season.json").catch(function () { return {}; }),
      loadJson("data/matches_" + key + ".json").catch(function () { return []; }),
    ]).then(function (r) {
      if (r[0]) datasets[key].all_time = { ratings: r[0], teams: r[0].teams || [], history: r[1] || {} };
      if (r[2]) datasets[key].season = { ratings: r[2], teams: r[2].teams || [], history: r[3] || {} };
      datasets[key].matches = r[4] || [];
    });
  }

  Promise.all([
    loadLeague("usl2"),
    loadLeague("wleague"),
    loadLeague("champ"),
    loadLeague("l1"),
    loadLeague("superleague"),
  ])
    .then(function () {
      render();
    })
    .catch(function (err) {
      boardBody.innerHTML =
        '<tr><td colspan="8" class="empty-row">Couldn\u2019t load ratings data (' +
        escapeHtml(err.message) + "). If this is a fresh setup, run the fetch + compute " +
        "scripts once and commit docs/data/*.json.</td></tr>";
      heroTeamName.textContent = "No data yet";
    });
})();
