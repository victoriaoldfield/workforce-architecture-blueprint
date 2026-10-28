// ============================================================
// APP CORE — icons, state, persistence, shared UI primitives,
// the Talent Blueprint wizard (drivers -> bu -> functions ->
// levels -> skills -> market redline -> approved), and the
// left-hand nav (sections + blueprint sheet index).
//
// modules.js (loaded after this file) adds the Org Map, Role
// Uploader, Skill Discovery, and Skills Frameworks sections —
// all reading/writing the same global `S` and calling the same
// `render()` / `handleAction()` used here.
// ============================================================
(function () {
  "use strict";

  // ── Icons — Material Symbols (Outlined), loaded via Google Fonts in
  // index.html. `ic(name, sizePx)` keeps the same call signature every
  // render function already uses; only the glyph mapping + markup changed.
  var ICON_GLYPHS = {
    plus: "add", minus: "remove", x: "close", check: "check",
    arrow: "arrow_forward", back: "arrow_back", pencil: "edit", spark: "auto_awesome",
    loader: "progress_activity", dot: "radio_button_unchecked", reset: "restart_alt",
    download: "download", compass: "architecture", map: "map", upload: "upload_file",
    search: "search", shield: "shield", lock: "lock", file: "description",
    fit: "fit_screen", alert: "warning", expand: "expand_more",
  };
  function ic(name, sizePx) {
    var glyph = ICON_GLYPHS[name] || "help";
    var cls = "msi" + (name === "loader" ? " spin" : "");
    var style = sizePx ? ' style="font-size:' + sizePx + 'px;"' : "";
    return '<span class="' + cls + '"' + style + '>' + glyph + "</span>";
  }
  window.ic = ic;

  // ============================================================
  // STATE
  // ============================================================
  var uid = 0;
  function nid(prefix) { uid += 1; return prefix + "-" + uid; }
  window.nid = nid;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  window.esc = esc;

  function defaultState() {
    return {
      section: "blueprint",
      phase: "cover",
      log: [],
      checkpoints: {},
      drivers: [], bu: [], fns: [], levels: [], levelTemplateName: "",
      fnSkills: {}, fnFunctionalSkills: {},
      blocks: [],
      draftStepsDone: 0,

      // Organisation Lookup — the market-data kick-off step (see data.js
      // lookupOrganization). `org` is the persisted summary once applied;
      // everything else here is working state for the lookup screens.
      org: null,
      orgStage: "lookup", orgProcessingDone: 0,
      pendingOrgName: "", pendingOrgDomain: "", pendingOrgIndustryOverride: "auto",
      orgProfile: null,
      orgChecked: { bu: [], drivers: [], soft: [], functional: [] },
      orgTrendingSoft: [], orgTrendingFunctional: [],

      pendingDrivers: [], pendingBU: [],
      // Functions screen: all business units shown at once, each with its
      // own pending chip list, keyed by bu.id — no more one-BU-at-a-time.
      pendingFnNamesByBu: {},
      // Function-skills table: which function rows are expanded for editing
      // (soft/functional skills live directly on S.fnSkills/fnFunctionalSkills
      // — no staging, toggles commit immediately, same as BU/level skills).
      fnRowsOpen: [],
      skillsStage: "bu", // "bu" | "level" | "function" — which consolidated screen, not a loop position
      editingBlockId: null, editingDraftSkills: null,
      transcriptCollapsed: true,

      // Cross-module skill assignment (via Skill Discovery)
      driverSkills: {}, buSkills: {}, levelSkills: {},
      skillsInventory: [],

      // Org Map
      orgmapView: { x: 40, y: 20, scale: 1 },
      orgmapSelected: null,
      orgmapExpandedFns: [],
      orgmapMode: "graph", // "graph" | "heatmap"
      orgmapShowSkills: false,

      // Role Uploader
      uploader: { fileName: null, rows: [], uploadedRoles: [] },

      // Skill Discovery
      discovery: { targetType: "driver", targetId: null, docName: null, docText: "", analysis: null, checked: {} },

      // Skills Frameworks
      frameworks: [],
      editingFrameworkId: null,
      fwPendingSkills: [],

      toast: null,
    };
  }

  // `S` is a single, never-reassigned object — modules.js caches a reference
  // to it once at load time, so every reset below mutates its contents in
  // place (delete-all-keys then Object.assign) rather than pointing the `S`
  // variable at a new object, which would silently orphan that cached ref.
  var S = defaultState();
  window.getS = function () { return S; };

  function replaceStateInPlace(next) {
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.assign(S, next);
  }

  var STORAGE_KEY = "workforce-architecture-blueprint-state-v1";
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* ignore quota/availability errors */ }
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      replaceStateInPlace(Object.assign(defaultState(), saved));
      // Reset transient/in-flight UI state that shouldn't survive a reload.
      S.editingBlockId = null;
      S.toast = null;
      if (S.phase === "processing") S.phase = S.blocks.length ? "redline" : "skills";
      if (S.phase === "org" && S.orgStage === "processing") S.orgStage = S.orgProfile ? "results" : "lookup";
    } catch (e) { /* corrupt or unavailable storage — start fresh */ }
  }

  function pushLog(role, text) { S.log.push({ id: nid("log"), role: role, text: text }); }
  window.pushLog = pushLog;

  function showToast(text) {
    S.toast = { id: nid("toast"), text: text };
    render();
    setTimeout(function () { if (S.toast && S.toast.text === text) { S.toast = null; render(); } }, 3600);
  }
  window.showToast = showToast;

  // Shared by the Org Map's skills layer and the critical-skills ranking
  // below — one call shape so "how many places does this skill touch"
  // means exactly the same thing in both places.
  function skillGraphFromState() {
    return computeSkillGraph({
      drivers: S.drivers, bu: S.bu, fns: S.fns, levels: S.levels,
      driverSkills: S.driverSkills, buSkills: S.buSkills,
      fnSkills: S.fnSkills, fnFunctionalSkills: S.fnFunctionalSkills,
      levelSkills: S.levelSkills,
    });
  }
  window.skillGraphFromState = skillGraphFromState;

  // ============================================================
  // NAV STRUCTURE
  // ============================================================
  var PHASE_ORDER = [
    { key: "org", label: "Organisation" },
    { key: "drivers", label: "Strategic Drivers" },
    { key: "bu", label: "Business Units" },
    { key: "functions", label: "Functions" },
    { key: "levels", label: "Role Levels" },
    { key: "skills", label: "Skills" },
    { key: "redline", label: "Market Redline" },
  ];
  window.PHASE_ORDER = PHASE_ORDER;

  var SECTIONS = [
    { key: "blueprint", label: "Talent Blueprint", icon: "compass" },
    { key: "orgmap", label: "Org Map", icon: "map" },
    { key: "uploader", label: "Role Uploader", icon: "upload" },
    { key: "discovery", label: "Skill Discovery", icon: "search" },
    { key: "frameworks", label: "Skills Frameworks", icon: "shield" },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  var root = document.getElementById("app");
  var navRoot = document.getElementById("navidx");

  function render() {
    var html = '<span class="crop tl"></span><span class="crop tr"></span><span class="crop bl"></span><span class="crop br"></span>';
    html += renderTitleblock();
    if (S.section === "blueprint") {
      if (S.log.length && S.phase !== "cover") html += renderTranscript();
      html += renderBlueprintPhase();
    } else if (S.section === "orgmap") {
      html += window.renderOrgMap();
    } else if (S.section === "uploader") {
      html += window.renderUploader();
    } else if (S.section === "discovery") {
      html += window.renderDiscovery();
    } else if (S.section === "frameworks") {
      html += window.renderFrameworks();
    }
    root.innerHTML = html;
    navRoot.innerHTML = renderSheetIndex();
    if (S.toast) {
      var t = document.createElement("div");
      t.className = "toast";
      t.textContent = S.toast.text;
      document.body.appendChild(t);
    }
    if (S.section === "orgmap" && window.wireOrgMapInteractions) window.wireOrgMapInteractions();
    saveState();
  }
  window.render = render;

  function renderTitleblock() {
    var sectionMeta = SECTIONS.filter(function (s) { return s.key === S.section; })[0];
    var sheetLabel = sectionMeta ? sectionMeta.label : "—";
    var sheetNum = "00";
    if (S.section === "blueprint") {
      if (S.phase === "cover") { sheetNum = "00"; sheetLabel = "Cover"; }
      else {
        var key = S.phase === "processing" || S.phase === "final" ? "redline" : S.phase;
        var idx = PHASE_ORDER.map(function (p) { return p.key; }).indexOf(key);
        if (idx >= 0) { sheetNum = String(idx + 1).padStart(2, "0"); sheetLabel = S.phase === "final" ? "Approved" : PHASE_ORDER[idx].label; }
      }
    }
    var today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    var projectValue = S.org ? esc(S.org.name) + " — Workforce Architecture" : "Workforce Architecture";
    var sheetTotal = String(PHASE_ORDER.length).padStart(2, "0");
    return (
      '<div class="titleblock mono">' +
        '<div class="tb-project"><div class="tb-label">Project</div><div class="tb-value">' + projectValue + '</div></div>' +
        '<div class="tb-sheet"><div class="tb-label">Sheet</div><div class="tb-value mono">' + sheetNum + (S.section === "blueprint" ? " / " + sheetTotal : "") + ' — ' + esc(sheetLabel) + '</div></div>' +
        '<div class="tb-scale"><div class="tb-label">Drawn</div><div class="tb-value mono">' + today + '</div></div>' +
      '</div>'
    );
  }

  // Left-hand nav: top-level section switcher, plus (only while the
  // Blueprint section is active) the sheet index of wizard steps —
  // like the index bound at the front of a real drawing set.
  var NAV_BLUEPRINT_ITEMS = PHASE_ORDER.concat([{ key: "final", label: "Approved" }]);
  function renderSheetIndex() {
    var activeKey = S.phase === "processing" ? "redline" : S.phase;
    var out = '<div class="idx-brand">' + ic("compass") + '<span class="idx-brand-text">Workforce<br/>Architecture</span></div>';

    out += '<div class="idx-list">';
    SECTIONS.forEach(function (sec) {
      var active = S.section === sec.key;
      out += '<button type="button" class="idx-item idx-section-item ' + (active ? "active" : "done") + '" data-action="section-switch" data-section="' + sec.key + '">';
      out += '<span class="idx-status">' + ic(sec.icon) + '</span><span class="idx-label">' + esc(sec.label) + '</span>';
      out += '</button>';
    });
    out += '</div>';

    if (S.section === "blueprint") {
      out += '<div class="idx-section-label">Blueprint Sheets</div><div class="idx-list idx-sub">';
      NAV_BLUEPRINT_ITEMS.forEach(function (item, i) {
        var reached = item.key === "final" ? S.phase === "final" : S.checkpoints[item.key] !== undefined;
        var current = activeKey === item.key;
        var state = current ? "active" : (reached ? "done" : "upcoming");
        var clickable = reached && !current && item.key !== "final";
        var tag = clickable ? "button" : "div";
        var mark = current ? ic("dot") : (reached ? ic("check") : "");
        out += "<" + tag + ' class="idx-item ' + state + '"' + (clickable ? ' type="button" data-action="nav-jump" data-phase="' + item.key + '"' : "") + ">";
        out += '<span class="idx-num mono">' + String(i + 1).padStart(2, "0") + '</span><span class="idx-label">' + item.label + '</span><span class="idx-status">' + mark + '</span>';
        out += "</" + tag + ">";
      });
      out += "</div>";
    }

    var glance = "";
    if (S.drivers.length) glance += '<div class="idx-glance-row"><span>Strategic drivers</span><b class="mono">' + S.drivers.length + '</b></div>';
    if (S.bu.length) glance += '<div class="idx-glance-row"><span>Business units</span><b class="mono">' + S.bu.length + '</b></div>';
    if (S.fns.length) glance += '<div class="idx-glance-row"><span>Functions</span><b class="mono">' + S.fns.length + '</b></div>';
    if (S.levels.length) glance += '<div class="idx-glance-row"><span>Role levels</span><b class="mono">' + S.levels.length + '</b></div>';
    if (S.blocks.length) {
      var approvedN = S.blocks.filter(function (b) { return b.status === "approved" || b.status === "edited"; }).length;
      glance += '<div class="idx-glance-row"><span>Blocks approved</span><b class="mono">' + approvedN + " / " + S.blocks.length + "</b></div>";
    }
    if (S.uploader.uploadedRoles.length) glance += '<div class="idx-glance-row"><span>Roles uploaded</span><b class="mono">' + S.uploader.uploadedRoles.length + '</b></div>';
    if (S.frameworks.length) glance += '<div class="idx-glance-row"><span>Skills frameworks</span><b class="mono">' + S.frameworks.length + '</b></div>';
    if (glance) out += '<div class="idx-glance"><div class="idx-glance-label">At a glance</div>' + glance + "</div>";
    return out;
  }

  function renderTranscript() {
    var entries = S.transcriptCollapsed ? S.log.slice(-2) : S.log;
    var out = '<div class="transcript">';
    if (S.log.length > 2) {
      out += '<button class="transcript-toggle" data-action="transcript-toggle">' + (S.transcriptCollapsed ? "▾ Show " + (S.log.length - 2) + " earlier note" + (S.log.length - 2 === 1 ? "" : "s") : "▴ Collapse") + '</button>';
    }
    entries.forEach(function (e) {
      if (e.role === "agent") {
        out += '<div class="note"><span class="note-badge">' + ic("compass", 18) + '</span><div class="note-body"><div class="note-label">Field note</div><div class="note-text" style="font-size:13px;">' + esc(e.text) + '</div></div></div>';
      } else {
        out += '<div class="response"><span class="tag">Logged</span>' + esc(e.text) + '</div>';
      }
    });
    out += '</div>';
    return out;
  }

  function renderBlueprintPhase() {
    switch (S.phase) {
      case "cover": return renderCover();
      case "org": return renderOrg();
      case "drivers": return renderDrivers();
      case "bu": return renderBU();
      case "functions": return renderFunctions();
      case "levels": return renderLevels();
      case "skills": return renderSkills();
      case "processing": return renderProcessing();
      case "redline": return renderRedline();
      case "final": return renderFinal();
    }
    return "";
  }

  function renderCover() {
    return (
      '<div class="cover">' +
        '<div class="cover-mark">' + ic("compass") + '</div>' +
        '<h1 class="mono" style="color:var(--primary);">WORKFORCE ARCHITECTURE</h1>' +
        '<p>A drafting session for your organization: kicked off with Lightcast market data, then strategic drivers, business units, functions, and role levels, tagged with soft and functional skills and checked against live market data before anything is approved.</p>' +
        '<div class="cover-legend">' +
          '<div>' + ic("search") + ' Market data</div>' +
          '<div>' + ic("dot") + ' Strategic drivers</div>' +
          '<div>' + ic("dot") + ' Business units</div>' +
          '<div>' + ic("dot") + ' Functions &amp; levels</div>' +
          '<div>' + ic("spark") + ' Skills</div>' +
          '<div>' + ic("pencil") + ' Market redline</div>' +
        '</div>' +
        '<button class="btn-primary" data-action="start">Open the drafting table ' + ic("arrow") + '</button>' +
      '</div>'
    );
  }

  // ── shared: agent note + chip editor ──
  function agentNote(text) {
    return '<div class="note"><span class="note-badge">' + ic("compass", 18) + '</span><div class="note-body"><div class="note-label">Field note</div><div class="note-text">' + text + '</div></div></div>';
  }
  window.agentNote = agentNote;

  function chipEditor(stateKey, suggestions, placeholder, inputId) {
    var values = S[stateKey];
    var remaining = suggestions.filter(function (s) { return values.indexOf(s) === -1; });
    var out = "";
    if (values.length) {
      out += '<div class="chips">';
      values.forEach(function (v) {
        out += '<span class="chip">' + esc(v) + '<button data-action="chip-remove" data-key="' + stateKey + '" data-value="' + esc(v) + '">' + ic("x") + '</button></span>';
      });
      out += '</div>';
    }
    out += '<div class="input-row"><input type="text" id="' + inputId + '-input" data-chip-input data-key="' + stateKey + '" placeholder="' + esc(placeholder) + '" />';
    out += '<button class="btn-add" data-action="chip-add" data-key="' + stateKey + '" data-input="' + inputId + '-input">' + ic("plus") + ' Add</button></div>';
    if (remaining.length) {
      out += '<div style="font-size:11px;color:var(--text-hint);margin-bottom:6px;">Suggestions</div><div class="chips">';
      remaining.forEach(function (s) { out += '<button class="suggestion" data-action="chip-add-suggestion" data-key="' + stateKey + '" data-value="' + esc(s) + '">+ ' + esc(s) + '</button>'; });
      if (remaining.length > 1) out += '<button class="add-all" data-action="chip-add-all" data-key="' + stateKey + '">+ Add all</button>';
      out += '</div>';
    }
    return out;
  }
  window.chipEditor = chipEditor;

  // A second chip editor for state shaped as a map keyed by entity id
  // (e.g. pendingFnNamesByBu[bu.id]) rather than a single flat array —
  // used by the all-business-units-at-once Functions screen. Mirrors
  // chipEditor's markup exactly; only the storage shape and action names
  // differ, since the generic chip-* actions assume a flat S[key].
  function chipEditorFor(map, entityId, suggestions, placeholder, inputId) {
    var values = map[entityId] || (map[entityId] = []);
    var remaining = suggestions.filter(function (s) { return values.indexOf(s) === -1; });
    var out = "";
    if (values.length) {
      out += '<div class="chips">';
      values.forEach(function (v) {
        out += '<span class="chip">' + esc(v) + '<button data-action="fnchip-remove" data-bu="' + entityId + '" data-value="' + esc(v) + '">' + ic("x") + '</button></span>';
      });
      out += '</div>';
    }
    out += '<div class="input-row"><input type="text" id="' + inputId + '-input" data-chip-input data-bu="' + entityId + '" placeholder="' + esc(placeholder) + '" />';
    out += '<button class="btn-add" data-action="fnchip-add" data-bu="' + entityId + '" data-input="' + inputId + '-input">' + ic("plus") + ' Add</button></div>';
    if (remaining.length) {
      out += '<div style="font-size:11px;color:var(--text-hint);margin-bottom:6px;">Suggestions</div><div class="chips">';
      remaining.forEach(function (s) { out += '<button class="suggestion" data-action="fnchip-add-suggestion" data-bu="' + entityId + '" data-value="' + esc(s) + '">+ ' + esc(s) + '</button>'; });
      if (remaining.length > 1) out += '<button class="add-all" data-action="fnchip-add-all" data-bu="' + entityId + '">+ Add all</button>';
      out += '</div>';
    }
    return out;
  }
  window.chipEditorFor = chipEditorFor;

  function pillGrid(catalog, selected, action, extraData, funcStyle) {
    var out = '<div class="pill-grid">';
    catalog.forEach(function (s) {
      var on = selected.indexOf(s) !== -1;
      out += '<button class="pill ' + (on ? "on" : "") + (on && funcStyle ? " func" : "") + '" data-action="' + action + '" data-skill="' + esc(s) + '"' + (extraData || "") + '>' + esc(s) + '</button>';
    });
    out += '</div>';
    return out;
  }
  window.pillGrid = pillGrid;

  // ── Organisation Lookup — simulated Lightcast market-data kick-off ──
  // One phase, three stages (lookup -> processing -> results), same
  // pattern as the Skills phase's bu/level/function stages below.
  function renderOrg() {
    if (S.orgStage === "processing") return renderOrgProcessing();
    if (S.orgStage === "results") return renderOrgResults();
    return renderOrgLookup();
  }

  function renderOrgLookup() {
    var out = '<div>';
    out += agentNote("Who are we building this workforce architecture for? Tell me the organisation and I'll pull market intelligence from Lightcast — comparable postings, trending skills, top titles — to kick off your blueprint. You can always build it manually instead.");
    out += '<div class="input-row"><input type="text" id="org-name-input" value="' + esc(S.pendingOrgName) + '" placeholder="Organisation name — e.g. Acme Robotics" /></div>';
    out += '<div class="input-row"><input type="text" id="org-domain-input" value="' + esc(S.pendingOrgDomain) + '" placeholder="Domain or website (optional) — e.g. acmerobotics.com" /></div>';
    out += '<div class="input-row"><select id="org-industry-select">';
    out += '<option value="auto"' + (S.pendingOrgIndustryOverride === "auto" ? " selected" : "") + '>Auto-detect industry from name</option>';
    INDUSTRY_LIST.forEach(function (ind) {
      out += '<option value="' + ind.key + '"' + (S.pendingOrgIndustryOverride === ind.key ? " selected" : "") + '>' + esc(ind.label) + '</option>';
    });
    out += '</select></div>';
    out += '<div class="actions"><button class="btn-ghost" data-action="org-skip">Skip — I\'ll build this manually</button><button class="btn-primary" data-action="org-lookup-run">' + ic("search") + ' Look up market data</button></div>';
    out += '</div>';
    return out;
  }

  var ORG_STEPS = [
    "Resolving organisation & matching industry classification…",
    "Querying the Lightcast job postings index…",
    "Identifying comparable titles & trending skills…",
    "Drafting starter recommendations for your blueprint…",
  ];
  function renderOrgProcessing() {
    var out = '<div>';
    out += '<div class="note" style="margin-bottom:18px;"><span class="note-badge">' + ic("loader") + '</span><div class="note-body"><div class="note-label">Pulling Lightcast market data</div><div class="note-text" style="font-size:14px;">This usually takes a few seconds.</div></div></div>';
    out += '<div class="draft-steps">';
    ORG_STEPS.forEach(function (step, i) {
      var cls = i < S.orgProcessingDone ? "done" : (i === S.orgProcessingDone ? "active" : "");
      var mark = i < S.orgProcessingDone ? ic("check") : (i === S.orgProcessingDone ? ic("loader") : ic("dot"));
      out += '<div class="draft-step ' + cls + '">' + mark + '<span>' + step + '</span></div>';
    });
    out += '</div></div>';
    return out;
  }

  function renderOrgResults() {
    var p = S.orgProfile;
    if (!p) return renderOrgLookup();
    var out = '<div>';

    out += '<div class="panel">';
    out += '<div class="panel-title">' + ic("search", 14) + ' Lightcast market profile</div>';
    out += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">';
    out += '<div><div style="font-size:16px;font-weight:500;color:var(--text);">' + esc(S.pendingOrgName) + '</div>';
    if (S.pendingOrgDomain) out += '<div style="font-size:12px;color:var(--text-secondary);">' + esc(S.pendingOrgDomain) + '</div>';
    out += '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:8px;max-width:58ch;">' + esc(p.description) + '</div></div>';
    out += '<div style="text-align:right;flex-shrink:0;">';
    out += '<span class="badge exempt">' + esc(p.industryLabel) + '</span>';
    out += '<div style="font-size:10.5px;color:var(--text-hint);margin-top:6px;">NAICS ' + esc(p.naics) + (p.wasDetected ? " · auto-detected" : " · manually selected") + '</div>';
    out += '</div></div>';
    out += '<div class="actions" style="margin-top:14px;"><button class="btn-ghost" data-action="org-relookup">' + ic("back") + ' Not quite right? Adjust &amp; re-run</button><span></span></div>';
    out += '</div>';

    out += '<div class="summary-bar">';
    out += '<div class="summary-stats">';
    out += '<div class="stat"><div class="num mono">' + p.postingsAnalyzed.toLocaleString() + '</div><div class="lbl">Postings analyzed</div></div>';
    out += '<div class="stat"><div class="num mono">' + p.companiesSampled.toLocaleString() + '</div><div class="lbl">Companies sampled</div></div>';
    out += '<div class="stat approved"><div class="num mono">+' + p.growthRate + '%</div><div class="lbl">YoY posting growth</div></div>';
    out += '<div class="stat"><div class="num mono">$' + Math.round(p.avgSalary / 1000) + 'k</div><div class="lbl">Avg. salary</div></div>';
    out += '</div></div>';

    out += '<div class="panel"><div class="panel-title">Top roles by posting volume</div>';
    out += '<div class="table-scroll"><table class="role-table"><thead><tr><th>Title</th><th>Postings</th></tr></thead><tbody>';
    p.topTitles.forEach(function (t) {
      out += '<tr><td>' + esc(t.title) + '</td><td class="mono">' + t.postings.toLocaleString() + '</td></tr>';
    });
    out += '</tbody></table></div></div>';

    out += '<div class="panel"><div class="panel-title">Suggested business units</div>';
    out += pillGrid(p.businessUnits, S.orgChecked.bu, "org-toggle-bu");
    out += '</div>';

    out += '<div class="panel"><div class="panel-title">Suggested strategic drivers</div>';
    out += pillGrid(p.strategicDrivers, S.orgChecked.drivers, "org-toggle-driver");
    out += '</div>';

    out += '<div class="panel"><div class="panel-title">Trending skills in ' + esc(p.industryLabel) + ' (Lightcast)</div>';
    out += '<div class="suggestion-cols">';
    out += '<div class="suggestion-col"><h4>Soft skills</h4>';
    p.trendingSoftSkills.forEach(function (s) {
      out += '<label class="suggestion-check"><input type="checkbox" ' + (S.orgChecked.soft.indexOf(s) !== -1 ? "checked" : "") + ' data-action="org-toggle-soft" data-skill="' + esc(s) + '"/>' + esc(s) + '</label>';
    });
    out += '</div><div class="suggestion-col"><h4>Functional skills</h4>';
    p.trendingFunctionalSkills.forEach(function (s) {
      out += '<label class="suggestion-check"><input type="checkbox" ' + (S.orgChecked.functional.indexOf(s) !== -1 ? "checked" : "") + ' data-action="org-toggle-functional" data-skill="' + esc(s) + '"/>' + esc(s) + '</label>';
    });
    out += '</div></div></div>';

    out += '<div class="actions"><button class="btn-ghost" data-action="org-skip">Build manually instead</button><button class="btn-primary" data-action="org-apply">Use as my Blueprint starting point ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // ── Strategic Drivers ──
  function renderDrivers() {
    var out = '<div>';
    out += agentNote("What strategic drivers are shaping your organization's direction over the next few years? These sit above your operating structure — you'll be able to tag them with skills directly from strategy documents later, in Skill Discovery.");
    out += chipEditor("pendingDrivers", SUGGESTED_DRIVERS, "e.g. Digital Transformation", "drv");
    out += '<div class="actions"><button class="btn-ghost" data-action="drivers-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="drivers-continue" ' + (S.pendingDrivers.length ? "" : "disabled") + '>Continue ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // ── Business units ──
  function renderBU() {
    var out = '<div>';
    out += agentNote("What business units make up your organization? Add as many as you like.");
    out += chipEditor("pendingBU", SUGGESTED_BUS, "e.g. Engineering & Technology", "bu");
    out += '<div class="actions"><button class="btn-ghost" data-action="bu-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="bu-continue" ' + (S.pendingBU.length ? "" : "disabled") + '>Continue ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // ── Functions — every business unit shown at once, not one-per-screen ──
  function renderFunctions() {
    var out = '<div>';
    out += agentNote("What functions or departments exist within each business unit? I've suggested some common ones for each — add, remove, or type your own.");
    S.bu.forEach(function (bu) {
      out += '<div class="wizard-group"><div class="wizard-group-title">' + esc(bu.name) + '</div>';
      out += chipEditorFor(S.pendingFnNamesByBu, bu.id, suggestFunctionsFor(bu.name), "e.g. Software Engineering", "fn-" + bu.id);
      out += '</div>';
    });
    var totalCount = S.bu.reduce(function (sum, bu) { return sum + (S.pendingFnNamesByBu[bu.id] || []).length; }, 0);
    out += '<div class="actions"><button class="btn-ghost" data-action="functions-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="functions-continue" ' + (totalCount ? "" : "disabled") + '>Continue ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // ── Role levels ──
  function renderLevels() {
    var names = Object.keys(LEVEL_TEMPLATES);
    var selected = S.levelTemplateName || names[0];
    var out = '<div>';
    out += agentNote("What role levels should apply across your organization? This framework will be shared across every function.");
    out += '<div class="levels-grid">';
    names.forEach(function (name) {
      var active = name === selected;
      out += '<button class="level-card ' + (active ? "active" : "") + '" data-action="level-select" data-template="' + esc(name) + '">';
      out += '<div class="lt-name">' + esc(name) + '</div><div class="lt-steps">';
      LEVEL_TEMPLATES[name].forEach(function (l) { out += '<span class="lt-step">' + esc(l.name) + '</span>'; });
      out += '</div></button>';
    });
    out += '</div>';
    out += '<div class="actions"><button class="btn-ghost" data-action="levels-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="level-continue">Use this framework ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // ── Skills roll down three layers: business unit -> role level ->
  // function. Each layer is ONE screen showing every entity at once (no
  // more one-per-screen stepping) — a role at the BU x Function x Level
  // intersection inherits all three when the market redline runs (see
  // beginProcessing / buildAlignmentBlock).
  function renderSkills() {
    if (S.skillsStage === "bu") return renderBuSkillsStage();
    if (S.skillsStage === "level") return renderLevelSkillsStage();
    return renderFunctionSkillsStage();
  }

  // A row of quick-add chips for skills carried through from the
  // Organisation Lookup step's Lightcast trending-skills panel — only
  // shown once an org profile was applied, and only for ones not already
  // in the current pending list.
  function renderTrendingQuickAdd(trendingList, pendingList, action, extraData) {
    var remaining = trendingList.filter(function (s) { return pendingList.indexOf(s) === -1; });
    if (!remaining.length) return "";
    var out = '<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-hint);margin-bottom:6px;">Trending for ' + esc(S.org.industryLabel) + ' (Lightcast)</div><div class="chips">';
    remaining.forEach(function (s) { out += '<button class="suggestion" data-action="' + action + '" data-skill="' + esc(s) + '"' + (extraData || "") + '>+ ' + esc(s) + '</button>'; });
    out += '</div></div>';
    return out;
  }

  // All business units at once — direct-mutates S.buSkills, no staging.
  function renderBuSkillsStage() {
    var out = '<div>';
    out += agentNote("Which skills matter across each business unit as a whole — regardless of function or level? These roll down into every role beneath it. Entirely optional, for every one.");
    out += '<div class="skill-row-head"><span></span><button class="link-btn" data-action="buskills-suggest-all">' + ic("spark") + ' Suggest for all</button></div>';
    S.bu.forEach(function (bu) {
      var list = S.buSkills[bu.id] || [];
      out += '<div class="wizard-group"><div class="wizard-group-title">' + esc(bu.name) + '</div>';
      if (S.org) out += renderTrendingQuickAdd(S.orgTrendingSoft, list, "buskill-add-trending", ' data-bu="' + bu.id + '"');
      out += pillGrid(SOFT_SKILLS, list, "buskill-toggle", ' data-bu="' + bu.id + '"');
      out += '</div>';
    });
    out += '<div class="actions"><button class="btn-ghost" data-action="buskills-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="buskills-continue">Continue to role levels ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // All role levels at once — direct-mutates S.levelSkills, no staging.
  function renderLevelSkillsStage() {
    var out = '<div>';
    out += agentNote("Which skills matter at each role level, regardless of function or business unit? These roll down into every role at that level. Entirely optional, for every one.");
    out += '<div class="skill-row-head"><span></span><button class="link-btn" data-action="levelskills-suggest-all">' + ic("spark") + ' Suggest for all</button></div>';
    S.levels.forEach(function (level) {
      var list = S.levelSkills[level.id] || [];
      out += '<div class="wizard-group"><div class="wizard-group-title">' + esc(level.name) + '</div>';
      out += pillGrid(SOFT_SKILLS, list, "levelskill-toggle", ' data-level="' + level.id + '"');
      out += '</div>';
    });
    out += '<div class="actions"><button class="btn-ghost" data-action="levelskills-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="levelskills-continue">Continue to functions ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  // Every function as a table row, grouped by business unit — collapsed to
  // a chip summary by default, expand any row to edit. Soft skills are
  // optional here too: beginProcessing() already falls back to a sensible
  // default for any function left untouched, so there's nothing to gate.
  function renderFunctionSkillsStage() {
    var out = '<div>';
    out += agentNote("Finally, which soft and functional skills matter for each function? These combine with what you just set for its business unit and every role level. Functional skills are pre-filled from each function's category — review and adjust any row, or leave it as-is.");
    out += '<div class="skill-row-head"><span></span><button class="link-btn" data-action="fnskills-suggest-all">' + ic("spark") + ' Suggest for all</button></div>';
    S.bu.forEach(function (bu) {
      var fns = S.fns.filter(function (f) { return f.buId === bu.id; });
      if (!fns.length) return;
      out += '<div class="wizard-group"><div class="wizard-group-title">' + esc(bu.name) + '</div>';
      fns.forEach(function (fn) { out += renderFunctionSkillRow(fn); });
      out += '</div>';
    });
    out += '<div class="actions"><button class="btn-ghost" data-action="fnskills-back">' + ic("back") + ' Back</button><button class="btn-primary" data-action="fnskills-continue">Finish &amp; align to market ' + ic("arrow") + '</button></div>';
    out += '</div>';
    return out;
  }

  function renderFunctionSkillRow(fn) {
    var open = S.fnRowsOpen.indexOf(fn.id) !== -1;
    var soft = S.fnSkills[fn.id] || [];
    var func = S.fnFunctionalSkills[fn.id] || [];
    var total = soft.length + func.length;
    var out = '<div class="fn-skill-row">';
    out += '<button class="fn-skill-row-head" data-action="fnrow-toggle" data-fn="' + fn.id + '">';
    out += '<span class="fn-skill-row-name">' + esc(fn.name) + '</span>';
    out += '<span class="fn-skill-row-summary">' + (total ? total + " skill" + (total === 1 ? "" : "s") : "No skills yet — will use defaults") + '</span>';
    out += '<span class="fn-skill-row-caret' + (open ? " open" : "") + '">' + ic("expand") + '</span>';
    out += '</button>';
    if (!open) {
      if (total) {
        var preview = soft.concat(func);
        out += '<div class="fn-skill-row-chips">' + preview.slice(0, 6).map(function (s) { return '<span class="sk">' + esc(s) + '</span>'; }).join("") + (preview.length > 6 ? '<span class="sk">+' + (preview.length - 6) + ' more</span>' : "") + '</div>';
      }
    } else {
      out += '<div class="fn-skill-row-body">';
      out += '<div class="skillset-label">Soft skills <button class="link-btn" style="margin-left:8px;" data-action="fnrow-suggest-soft" data-fn="' + fn.id + '">' + ic("spark") + ' Suggest</button></div>';
      if (S.org) out += renderTrendingQuickAdd(S.orgTrendingSoft, soft, "fnrow-add-trending-soft", ' data-fn="' + fn.id + '"');
      out += pillGrid(SOFT_SKILLS, soft, "fnrow-toggle-soft", ' data-fn="' + fn.id + '"');
      out += '<div class="skillset-label" style="margin-top:12px;">Functional skills <button class="link-btn" style="margin-left:8px;" data-action="fnrow-suggest-functional" data-fn="' + fn.id + '">' + ic("spark") + ' Re-suggest</button></div>';
      if (S.org) out += renderTrendingQuickAdd(S.orgTrendingFunctional, func, "fnrow-add-trending-functional", ' data-fn="' + fn.id + '"');
      out += pillGrid(ALL_FUNCTIONAL_SKILLS, func, "fnrow-toggle-functional", ' data-fn="' + fn.id + '"', true);
      out += '</div>';
    }
    out += '</div>';
    return out;
  }

  // ── Processing ──
  var DRAFT_STEPS = [
    "Transferring taxonomy to the drafting table…",
    "Rolling business unit, role level, and function skills down to each role…",
    "Cross-hatching the combined skill set against market job classifications…",
    "Inking soft-skill and functional-skill redlines from live market signal…",
  ];
  function renderProcessing() {
    var out = '<div>';
    out += '<div class="note" style="margin-bottom:18px;"><span class="note-badge">' + ic("loader") + '</span><div class="note-body"><div class="note-label">Aligning to market data</div><div class="note-text" style="font-size:14px;">This usually takes a few seconds.</div></div></div>';
    out += '<div class="draft-steps">';
    DRAFT_STEPS.forEach(function (step, i) {
      var cls = i < S.draftStepsDone ? "done" : (i === S.draftStepsDone ? "active" : "");
      var mark = i < S.draftStepsDone ? ic("check") : (i === S.draftStepsDone ? ic("loader") : ic("dot"));
      out += '<div class="draft-step ' + cls + '">' + mark + '<span>' + step + '</span></div>';
    });
    out += '</div></div>';
    return out;
  }

  // ── Redline review ──
  function renderRedline() {
    var approved = 0, rejected = 0;
    S.blocks.forEach(function (b) { if (b.status === "approved" || b.status === "edited") approved++; else if (b.status === "rejected") rejected++; });
    var pending = S.blocks.length - approved - rejected;

    var out = '<div>';
    out += '<div class="summary-bar">';
    out += '<div class="summary-stats">';
    out += '<div class="stat approved"><div class="num mono">' + approved + '</div><div class="lbl">Approved</div></div>';
    out += '<div class="stat pending"><div class="num mono">' + pending + '</div><div class="lbl">Pending</div></div>';
    out += '<div class="stat rejected"><div class="num mono">' + rejected + '</div><div class="lbl">Rejected</div></div>';
    out += '</div><div style="display:flex;gap:8px;">';
    if (pending > 0) out += '<button class="btn-ghost" data-action="redline-approve-remaining">' + ic("check") + ' Approve all remaining</button>';
    out += '<button class="btn-primary" data-action="redline-finish" ' + (pending > 0 ? "disabled" : "") + '>Finish setup ' + ic("arrow") + '</button>';
    out += '</div></div>';

    S.bu.forEach(function (bu) {
      var buFns = S.fns.filter(function (f) { return f.buId === bu.id; });
      if (!buFns.length) return;
      out += '<div class="bu-heading">' + esc(bu.name) + '</div>';
      buFns.forEach(function (fn) { out += renderFunctionPanel(fn); });
    });
    out += '</div>';
    return out;
  }

  function renderFunctionPanel(fn) {
    var blocks = S.blocks.filter(function (b) { return b.functionId === fn.id; });
    var pendingHere = blocks.some(function (b) { return b.status === "pending"; });
    var out = '<div class="detail-panel">';
    out += '<div class="detail-head"><span class="detail-title"><span class="tag">Detail</span>' + esc(fn.name) + '</span>';
    if (pendingHere) out += '<button class="link-btn" data-action="redline-approve-all-fn" data-fn="' + fn.id + '">Approve all levels</button>';
    out += '</div>';
    S.levels.forEach(function (level) {
      var block = blocks.filter(function (b) { return b.levelId === level.id; })[0];
      if (block) out += renderLevelRow(level, block);
    });
    out += '</div>';
    return out;
  }

  function renderLevelRow(level, block) {
    var badgeText = { pending: "Pending review", approved: "Approved", edited: "Edited & approved", rejected: "Rejected" }[block.status];
    var editing = S.editingBlockId === block.id;
    var out = '<div class="level-row" style="position:relative;">';
    if (block.status === "approved" || block.status === "edited") {
      out += '<div class="rubber-stamp">' + (block.status === "edited" ? "Edited<br/>OK" : "Approved") + '</div>';
    }
    out += '<div class="lr-top"><div><div class="lr-name">' + esc(level.name) + ' <span class="badge ' + block.status + '">' + badgeText + '</span></div>';
    out += '<div class="lr-meta">Benchmarked against ' + block.sampleSize.toLocaleString() + ' postings for "' + esc(block.comparableTitle) + '" · ' + block.confidence + '% confidence</div></div>';
    if (!editing) {
      out += '<div class="lr-actions">';
      out += '<button class="icon-btn" data-action="redline-edit-open" data-block="' + block.id + '">' + ic("pencil") + ' Edit</button>';
      if (block.status === "pending") {
        out += '<button class="icon-btn reject" data-action="redline-reject" data-block="' + block.id + '">' + ic("x") + ' Reject</button>';
        out += '<button class="icon-btn approve" data-action="redline-approve" data-block="' + block.id + '">' + ic("check") + ' Approve</button>';
      }
      if (block.status === "rejected") out += '<button class="icon-btn" data-action="redline-reconsider" data-block="' + block.id + '">' + ic("reset") + ' Reconsider</button>';
      out += '</div>';
    }
    out += '</div>';

    if (!editing) {
      var rowBu = S.bu.filter(function (b) { return b.id === block.buId; })[0];
      if (block.sources.bu.length) out += renderStaticSkillGroup("Rolled from " + (rowBu ? rowBu.name : "business unit") + " (BU layer)", block.sources.bu);
      if (block.sources.level.length) out += renderStaticSkillGroup("Rolled from " + level.name + " (role level layer)", block.sources.level);
      out += renderSkillsetGroup("Soft skills (combined & market-checked)", block.soft, block.status);
      out += renderSkillsetGroup("Functional skills", block.functional, block.status);
      if (block.status !== "rejected") out += '<div class="rationale">' + esc(block.soft.rationale) + ' — ' + esc(block.functional.rationale) + '</div>';
    } else {
      out += '<div class="skillset-label" style="margin-top:6px;">Soft skills</div>';
      out += pillGrid(SOFT_SKILLS, S.editingDraftSkills.soft, "redline-edit-toggle-soft", ' data-block="' + block.id + '"');
      out += '<div class="skillset-label">Functional skills</div>';
      out += pillGrid(ALL_FUNCTIONAL_SKILLS, S.editingDraftSkills.functional, "redline-edit-toggle-functional", ' data-block="' + block.id + '"', true);
      out += '<div class="edit-actions"><button class="btn-primary btn-small" data-action="redline-edit-save" data-block="' + block.id + '">Save</button><button class="btn-ghost btn-small" data-action="redline-edit-cancel">Cancel</button></div>';
    }
    out += '</div>';
    return out;
  }

  function renderSkillsetGroup(label, skillset, status) {
    var out = '<div class="skillset-group"><div class="skillset-label">' + label + '</div><div class="skillset">';
    skillset.final.forEach(function (s) {
      var added = skillset.added.indexOf(s) !== -1 && status !== "rejected";
      out += '<span class="sk ' + (added ? "added" : "") + '">' + (added ? "+ " : "") + esc(s) + '</span>';
    });
    skillset.removed.forEach(function (s) { out += '<span class="sk removed">' + esc(s) + '</span>'; });
    out += '</div></div>';
    return out;
  }

  // Read-only — these came from the BU or role-level layer, set once and
  // shared across every block at that layer, not edited per-block.
  function renderStaticSkillGroup(label, skills) {
    var out = '<div class="skillset-group"><div class="skillset-label">' + esc(label) + '</div><div class="skillset">';
    skills.forEach(function (s) { out += '<span class="sk">' + esc(s) + '</span>'; });
    out += '</div></div>';
    return out;
  }

  // ── Final ──
  function renderFinal() {
    var kept = S.blocks.filter(function (b) { return b.status !== "rejected"; });
    var uniq = {};
    kept.forEach(function (b) { b.soft.final.forEach(function (s) { uniq[s] = true; }); b.functional.final.forEach(function (s) { uniq[s] = true; }); });
    var today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    var out = '<div class="cover">';
    out += '<div class="final-stamp"><div class="final-stamp-inner mono"><div class="fs-top">BLUEPRINT<br/>APPROVED</div><div class="fs-date">' + today + '</div></div></div>';
    out += '<h1 style="font-size:22px;color:var(--primary);">Your workforce architecture is ready</h1>';
    out += '<p>Every strategic driver, business unit, function, and role level has been checked against market data and approved.</p>';
    out += '<div class="final-stats">';
    out += '<div class="final-stat"><div class="num">' + S.drivers.length + '</div><div class="lbl">Drivers</div></div>';
    out += '<div class="final-stat"><div class="num">' + S.bu.length + '</div><div class="lbl">Business units</div></div>';
    out += '<div class="final-stat"><div class="num">' + S.fns.length + '</div><div class="lbl">Functions</div></div>';
    out += '<div class="final-stat"><div class="num">' + S.levels.length + '</div><div class="lbl">Role levels</div></div>';
    out += '<div class="final-stat"><div class="num">' + Object.keys(uniq).length + '</div><div class="lbl">Skills mapped</div></div>';
    out += '</div>';

    var graph = skillGraphFromState();
    var topSkills = Object.keys(graph)
      .map(function (name) { return { name: name, count: graph[name].length }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 8);
    if (topSkills.length) {
      var maxCount = topSkills[0].count;
      out += '<div class="panel" style="text-align:left;max-width:480px;margin:0 auto 24px;">';
      out += '<div class="panel-title">Most load-bearing skills in your architecture</div>';
      topSkills.forEach(function (s, i) {
        var pct = Math.round((s.count / maxCount) * 100);
        out += '<button class="critical-skill-row" data-action="goto-skill-in-map" data-skill="' + esc(s.name) + '">';
        out += '<span class="critical-skill-rank mono">' + String(i + 1).padStart(2, "0") + '</span>';
        out += '<span class="critical-skill-name">' + esc(s.name) + '</span>';
        out += '<span class="critical-skill-bar-wrap"><span class="critical-skill-bar" style="width:' + pct + '%;"></span></span>';
        out += '<span class="critical-skill-count">' + s.count + ' place' + (s.count === 1 ? "" : "s") + '</span>';
        out += '</button>';
      });
      out += '<div style="font-size:11px;color:var(--text-hint);margin-top:10px;">Counted across strategic drivers, business units, functions, and role levels — click a skill to see where in the Org Map.</div>';
      out += '</div>';
    }

    if (S.org) {
      out += '<div class="governance-note">' + ic("search", 16) + ' Kicked off from <b>Lightcast market data</b> for ' + esc(S.org.name) + ' (' + esc(S.org.industryLabel) + ', NAICS ' + esc(S.org.naics) + ') — ' + S.org.postingsAnalyzed.toLocaleString() + ' postings analyzed across ' + S.org.companiesSampled.toLocaleString() + ' companies.</div>';
    }
    if (S.frameworks.length) {
      out += '<div class="governance-note">' + ic("shield", 16) + ' <b>' + S.frameworks.length + ' Skills Framework' + (S.frameworks.length === 1 ? "" : "s") + '</b> in your client-facing workspace ' + (S.frameworks.length === 1 ? "was" : "were") + ' left untouched — frameworks marked exempt from LCA never have their proficiency overwritten by a Talent Blueprint update like this one.</div>';
    }
    out += '<div class="final-actions">';
    out += '<button class="btn-primary" data-action="final-export">' + ic("download") + ' Export blueprint (.json)</button>';
    out += '<button class="btn-ghost" data-action="section-switch" data-section="orgmap">' + ic("map") + ' View Org Map</button>';
    out += '<button class="btn-ghost" data-action="final-restart">' + ic("reset") + ' Start a new blueprint</button>';
    out += '</div></div>';
    return out;
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  function addChip(key, value) {
    value = (value || "").trim();
    if (!value || S[key].indexOf(value) !== -1) return;
    S[key].push(value);
  }
  window.addChip = addChip;

  function addChipFor(map, entityId, value) {
    value = (value || "").trim();
    if (!value) return;
    var list = map[entityId] || (map[entityId] = []);
    if (list.indexOf(value) === -1) list.push(value);
  }
  window.addChipFor = addChipFor;

  function findBlock(id) { return S.blocks.filter(function (b) { return b.id === id; })[0]; }

  function beginProcessing() {
    S.phase = "processing";
    S.draftStepsDone = 0;
    S.blocks = [];
    S.fns.forEach(function (fn) {
      var bu = S.bu.filter(function (b) { return b.id === fn.buId; })[0];
      var soft = S.fnSkills[fn.id] || suggestSkillsForFunction(fn.name);
      var func = S.fnFunctionalSkills[fn.id] || suggestFunctionalSkillsForFunction(fn.name);
      var buSk = S.buSkills[bu.id] || [];
      S.levels.forEach(function (level) {
        var lvlSk = S.levelSkills[level.id] || [];
        S.blocks.push(buildAlignmentBlock(bu, fn, level, soft, func, buSk, lvlSk));
      });
    });
    render();
    tickDraft();
  }

  function tickDraft() {
    setTimeout(function () {
      S.draftStepsDone += 1;
      if (S.draftStepsDone >= DRAFT_STEPS.length) {
        render();
        setTimeout(function () {
          pushLog("agent", "Done — I've benchmarked " + S.blocks.length + " business unit/function/level combinations against market data. Review the redlines below.");
          S.phase = "redline";
          S.checkpoints.redline = S.log.length;
          render();
        }, 450);
      } else { render(); tickDraft(); }
    }, 700);
  }

  function tickOrgProcessing() {
    setTimeout(function () {
      S.orgProcessingDone += 1;
      if (S.orgProcessingDone >= ORG_STEPS.length) {
        render();
        setTimeout(function () {
          var p = S.orgProfile;
          pushLog(
            "agent",
            "Found it — " + p.industryLabel + " (NAICS " + p.naics + "), benchmarked against " + p.postingsAnalyzed.toLocaleString() +
              " postings across " + p.companiesSampled.toLocaleString() + " companies. Here's a starting point for your blueprint.",
          );
          S.orgStage = "results";
          render();
        }, 450);
      } else { render(); tickOrgProcessing(); }
    }, 650);
  }

  function exportBlueprint() {
    var payload = {
      organisation: S.org,
      strategicDrivers: S.drivers, businessUnits: S.bu, functions: S.fns, levels: S.levels,
      blocks: S.blocks.map(function (b) {
        return {
          businessUnit: (S.bu.filter(function (u) { return u.id === b.buId; })[0] || {}).name,
          function: (S.fns.filter(function (f) { return f.id === b.functionId; })[0] || {}).name,
          level: (S.levels.filter(function (l) { return l.id === b.levelId; })[0] || {}).name,
          skillSources: { businessUnit: b.sources.bu, roleLevel: b.sources.level, function: b.sources.function },
          softSkills: b.soft.final, functionalSkills: b.functional.final, status: b.status,
        };
      }),
      skillsFrameworks: S.frameworks,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "workforce-architecture-blueprint.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleAction(action, data, target) {
    switch (action) {
      case "section-switch": S.section = data.section; break;

      case "start":
        pushLog("agent", "Hi — I'll help you map your workforce architecture: strategic drivers, business units, functions, and role levels, tagged with soft and functional skills, then checked against market data. First, let's find out who we're building this for.");
        S.phase = "org";
        S.orgStage = "lookup";
        S.checkpoints.org = S.log.length;
        break;

      case "org-lookup-run": {
        var nameEl = document.getElementById("org-name-input"), domainEl = document.getElementById("org-domain-input"), industryEl = document.getElementById("org-industry-select");
        var name = nameEl ? nameEl.value.trim() : "";
        if (!name) { showToast("Enter an organisation name first."); break; }
        S.pendingOrgName = name;
        S.pendingOrgDomain = domainEl ? domainEl.value.trim() : "";
        S.pendingOrgIndustryOverride = industryEl ? industryEl.value : "auto";
        S.orgProfile = lookupOrganization(S.pendingOrgName, S.pendingOrgDomain, S.pendingOrgIndustryOverride);
        S.orgChecked = {
          bu: S.orgProfile.businessUnits.slice(),
          drivers: S.orgProfile.strategicDrivers.slice(),
          soft: S.orgProfile.trendingSoftSkills.slice(),
          functional: S.orgProfile.trendingFunctionalSkills.slice(),
        };
        S.orgStage = "processing";
        S.orgProcessingDone = 0;
        render();
        tickOrgProcessing();
        return;
      }
      case "org-relookup": S.orgStage = "lookup"; break;
      case "org-toggle-bu": { var tb = S.orgChecked.bu, ib = tb.indexOf(data.skill); if (ib === -1) tb.push(data.skill); else tb.splice(ib, 1); break; }
      case "org-toggle-driver": { var td = S.orgChecked.drivers, id2 = td.indexOf(data.skill); if (id2 === -1) td.push(data.skill); else td.splice(id2, 1); break; }
      case "org-toggle-soft": { var ts = S.orgChecked.soft, is = ts.indexOf(data.skill); if (is === -1) ts.push(data.skill); else ts.splice(is, 1); break; }
      case "org-toggle-functional": { var tf = S.orgChecked.functional, iff = tf.indexOf(data.skill); if (iff === -1) tf.push(data.skill); else tf.splice(iff, 1); break; }

      case "org-apply": {
        var p = S.orgProfile;
        S.org = {
          name: S.pendingOrgName, domain: S.pendingOrgDomain, industryKey: p.industryKey, industryLabel: p.industryLabel,
          naics: p.naics, postingsAnalyzed: p.postingsAnalyzed, companiesSampled: p.companiesSampled, growthRate: p.growthRate, avgSalary: p.avgSalary,
        };
        S.pendingDrivers = S.orgChecked.drivers.slice();
        S.pendingBU = S.orgChecked.bu.slice();
        S.orgTrendingSoft = S.orgChecked.soft.slice();
        S.orgTrendingFunctional = S.orgChecked.functional.slice();
        pushLog("agent", "Who are we building this workforce architecture for?");
        pushLog(
          "user",
          "Using Lightcast market data for " + S.pendingOrgName + " (" + p.industryLabel + ") as a starting point — " +
            S.pendingBU.length + " business unit" + (S.pendingBU.length === 1 ? "" : "s") + ", " +
            S.pendingDrivers.length + " strategic driver" + (S.pendingDrivers.length === 1 ? "" : "s") + ", and " +
            (S.orgTrendingSoft.length + S.orgTrendingFunctional.length) + " trending skills carried through.",
        );
        S.phase = "drivers";
        S.checkpoints.drivers = S.log.length;
        break;
      }
      case "org-skip": {
        // Explicitly clear S.org — if an earlier run had already applied
        // Lightcast data and the user jumped back to reconsider, choosing
        // Skip this time around must not leave stale "sourced from
        // Lightcast" data showing in the title block, export, or final sheet.
        S.org = null;
        S.orgTrendingSoft = []; S.orgTrendingFunctional = [];
        pushLog("agent", "Who are we building this workforce architecture for?");
        pushLog("user", "Skipping market lookup — building this manually.");
        S.phase = "drivers";
        S.checkpoints.drivers = S.log.length;
        break;
      }

      case "drivers-back": {
        S.phase = "org";
        S.orgStage = S.orgProfile ? "results" : "lookup";
        S.log.pop(); S.log.pop();
        break;
      }

      case "chip-add": { var input = document.getElementById(data.input); addChip(data.key, input ? input.value : ""); break; }
      case "chip-add-suggestion": addChip(data.key, data.value); break;
      case "chip-add-all": {
        // Only ever reached by pendingDrivers/pendingBU now — the Functions
        // screen's chip editors use fnchip-add-all, which carries its own
        // business-unit id and doesn't go through this generic path.
        var key = data.key;
        var suggestions = key === "pendingDrivers" ? SUGGESTED_DRIVERS : SUGGESTED_BUS;
        suggestions.forEach(function (s) { addChip(key, s); });
        break;
      }
      case "chip-remove": S[data.key] = S[data.key].filter(function (v) { return v !== data.value; }); break;

      case "drivers-continue": {
        S.drivers = S.pendingDrivers.map(function (n) { return { id: nid("drv"), name: n }; });
        pushLog("agent", "What strategic drivers are shaping your organization's direction?");
        pushLog("user", "Added: " + S.drivers.map(function (d) { return d.name; }).join(", "));
        S.pendingDrivers = [];
        S.phase = "bu";
        S.checkpoints.bu = S.log.length;
        break;
      }

      case "bu-back": S.phase = "drivers"; S.pendingDrivers = S.drivers.map(function (d) { return d.name; }); S.drivers = []; S.log.pop(); S.log.pop(); break;

      case "bu-continue": {
        S.bu = S.pendingBU.map(function (n) { return { id: nid("bu"), name: n }; });
        pushLog("agent", "What business units make up your organization?");
        pushLog("user", "Added: " + S.bu.map(function (b) { return b.name; }).join(", "));
        S.pendingBU = [];
        S.pendingFnNamesByBu = {};
        S.phase = "functions";
        S.checkpoints.functions = S.log.length;
        break;
      }

      // fnchip-* — the per-business-unit chip editors on the all-at-once
      // Functions screen (see chipEditorFor). Distinct from the generic
      // chip-* actions above since S.pendingFnNamesByBu is a map, not a
      // flat array.
      case "fnchip-add": { var fnInput = document.getElementById(data.input); addChipFor(S.pendingFnNamesByBu, data.bu, fnInput ? fnInput.value : ""); break; }
      case "fnchip-add-suggestion": addChipFor(S.pendingFnNamesByBu, data.bu, data.value); break;
      case "fnchip-add-all": {
        var buForAll = S.bu.filter(function (b) { return b.id === data.bu; })[0];
        (buForAll ? suggestFunctionsFor(buForAll.name) : []).forEach(function (s) { addChipFor(S.pendingFnNamesByBu, data.bu, s); });
        break;
      }
      case "fnchip-remove": {
        var fnList = S.pendingFnNamesByBu[data.bu] || [];
        S.pendingFnNamesByBu[data.bu] = fnList.filter(function (v) { return v !== data.value; });
        break;
      }

      case "functions-back": {
        S.phase = "bu";
        S.pendingBU = S.bu.map(function (b) { return b.name; });
        S.bu = [];
        S.log.pop(); S.log.pop();
        break;
      }
      case "functions-continue": {
        var createdFns = [];
        S.bu.forEach(function (bu) {
          (S.pendingFnNamesByBu[bu.id] || []).forEach(function (n) { createdFns.push({ id: nid("fn"), buId: bu.id, name: n }); });
        });
        S.fns = createdFns;
        pushLog("agent", "What functions or departments exist within each business unit?");
        pushLog("user", S.bu.map(function (bu) { return bu.name + ": " + ((S.pendingFnNamesByBu[bu.id] || []).join(", ") || "none"); }).join(" · "));
        S.phase = "levels";
        S.checkpoints.levels = S.log.length;
        break;
      }

      case "levels-back": {
        S.phase = "functions";
        S.pendingFnNamesByBu = {};
        S.bu.forEach(function (bu) {
          S.pendingFnNamesByBu[bu.id] = S.fns.filter(function (f) { return f.buId === bu.id; }).map(function (f) { return f.name; });
        });
        S.log.pop(); S.log.pop();
        break;
      }
      case "level-select": S.levelTemplateName = data.template; break;
      case "level-continue": {
        var tmpl = S.levelTemplateName || Object.keys(LEVEL_TEMPLATES)[0];
        S.levels = LEVEL_TEMPLATES[tmpl];
        S.levelTemplateName = tmpl;
        pushLog("user", 'Using the "' + tmpl + '" framework: ' + S.levels.map(function (l) { return l.name; }).join(" → "));
        S.skillsStage = "bu";
        S.phase = "skills";
        S.checkpoints.skills = S.log.length;
        break;
      }

      // BU-skills screen — every business unit shown at once; pills mutate
      // S.buSkills directly, no staging/pending array.
      case "buskill-toggle": { var buList = S.buSkills[data.bu] || (S.buSkills[data.bu] = []); var ib = buList.indexOf(data.skill); if (ib === -1) buList.push(data.skill); else buList.splice(ib, 1); break; }
      case "buskill-add-trending": { var buList2 = S.buSkills[data.bu] || (S.buSkills[data.bu] = []); if (buList2.indexOf(data.skill) === -1) buList2.push(data.skill); break; }
      case "buskills-suggest-all": S.bu.forEach(function (bu) { S.buSkills[bu.id] = suggestSkillsForBU(bu, S.fns); }); break;
      case "buskills-back": { S.phase = "levels"; S.log.pop(); S.log.pop(); break; }
      case "buskills-continue": {
        pushLog("agent", "Which skills matter across each business unit as a whole?");
        pushLog("user", S.bu.map(function (bu) { return bu.name + ": " + ((S.buSkills[bu.id] || []).join(", ") || "none"); }).join(" · "));
        S.skillsStage = "level";
        break;
      }

      // Level-skills screen — every role level shown at once; pills mutate
      // S.levelSkills directly.
      case "levelskill-toggle": { var lvlList = S.levelSkills[data.level] || (S.levelSkills[data.level] = []); var il = lvlList.indexOf(data.skill); if (il === -1) lvlList.push(data.skill); else lvlList.splice(il, 1); break; }
      case "levelskills-suggest-all": S.levels.forEach(function (level) { S.levelSkills[level.id] = suggestSkillsForLevel(level); }); break;
      case "levelskills-back": { S.skillsStage = "bu"; S.log.pop(); S.log.pop(); break; }
      case "levelskills-continue": {
        pushLog("agent", "Which skills matter at each role level?");
        pushLog("user", S.levels.map(function (level) { return level.name + ": " + ((S.levelSkills[level.id] || []).join(", ") || "none"); }).join(" · "));
        // Pre-fill functional skills for every function up front, here —
        // not lazily during render — so the table's "pre-filled" promise
        // is true the instant it paints.
        S.fns.forEach(function (fn) { if (!S.fnFunctionalSkills[fn.id] || !S.fnFunctionalSkills[fn.id].length) S.fnFunctionalSkills[fn.id] = suggestFunctionalSkillsForFunction(fn.name); });
        S.skillsStage = "function";
        break;
      }

      // Function-skills table — every function shown as a row, grouped by
      // business unit, collapsed to a chip summary by default. Toggles
      // mutate S.fnSkills / S.fnFunctionalSkills directly.
      case "fnrow-toggle": { var rowIdx = S.fnRowsOpen.indexOf(data.fn); if (rowIdx === -1) S.fnRowsOpen.push(data.fn); else S.fnRowsOpen.splice(rowIdx, 1); break; }
      case "fnrow-toggle-soft": { var softList = S.fnSkills[data.fn] || (S.fnSkills[data.fn] = []); var si2 = softList.indexOf(data.skill); if (si2 === -1) softList.push(data.skill); else softList.splice(si2, 1); break; }
      case "fnrow-toggle-functional": { var funcList = S.fnFunctionalSkills[data.fn] || (S.fnFunctionalSkills[data.fn] = []); var fi2 = funcList.indexOf(data.skill); if (fi2 === -1) funcList.push(data.skill); else funcList.splice(fi2, 1); break; }
      case "fnrow-add-trending-soft": { var softList2 = S.fnSkills[data.fn] || (S.fnSkills[data.fn] = []); if (softList2.indexOf(data.skill) === -1) softList2.push(data.skill); break; }
      case "fnrow-add-trending-functional": { var funcList2 = S.fnFunctionalSkills[data.fn] || (S.fnFunctionalSkills[data.fn] = []); if (funcList2.indexOf(data.skill) === -1) funcList2.push(data.skill); break; }
      case "fnrow-suggest-soft": { var fnForSoft = S.fns.filter(function (f) { return f.id === data.fn; })[0]; if (fnForSoft) S.fnSkills[fnForSoft.id] = suggestSkillsForFunction(fnForSoft.name); break; }
      case "fnrow-suggest-functional": { var fnForFunc = S.fns.filter(function (f) { return f.id === data.fn; })[0]; if (fnForFunc) S.fnFunctionalSkills[fnForFunc.id] = suggestFunctionalSkillsForFunction(fnForFunc.name); break; }
      case "fnskills-suggest-all": {
        S.fns.forEach(function (fn) {
          if (!S.fnSkills[fn.id] || !S.fnSkills[fn.id].length) S.fnSkills[fn.id] = suggestSkillsForFunction(fn.name);
          if (!S.fnFunctionalSkills[fn.id] || !S.fnFunctionalSkills[fn.id].length) S.fnFunctionalSkills[fn.id] = suggestFunctionalSkillsForFunction(fn.name);
        });
        break;
      }
      case "fnskills-back": { S.skillsStage = "level"; S.log.pop(); S.log.pop(); break; }
      case "fnskills-continue": {
        pushLog("agent", "Which soft and functional skills matter for each function?");
        pushLog(
          "user",
          S.fns.map(function (fn) {
            return fn.name + " — soft: " + ((S.fnSkills[fn.id] || []).join(", ") || "none") + "; functional: " + ((S.fnFunctionalSkills[fn.id] || []).join(", ") || "none");
          }).join(" · "),
        );
        beginProcessing();
        break;
      }

      case "redline-approve": { var b1 = findBlock(data.block); b1.status = "approved"; b1.soft.final = b1.soft.market.slice(); b1.functional.final = b1.functional.market.slice(); break; }
      case "redline-reject": findBlock(data.block).status = "rejected"; break;
      case "redline-reconsider": findBlock(data.block).status = "pending"; break;
      case "redline-approve-all-fn": S.blocks.forEach(function (b) { if (b.functionId === data.fn && b.status === "pending") { b.status = "approved"; b.soft.final = b.soft.market.slice(); b.functional.final = b.functional.market.slice(); } }); break;
      case "redline-approve-remaining": S.blocks.forEach(function (b) { if (b.status === "pending") { b.status = "approved"; b.soft.final = b.soft.market.slice(); b.functional.final = b.functional.market.slice(); } }); break;
      case "redline-edit-open": { var blk = findBlock(data.block); S.editingBlockId = data.block; S.editingDraftSkills = { soft: blk.soft.final.slice(), functional: blk.functional.final.slice() }; break; }
      case "redline-edit-toggle-soft": { var sList = S.editingDraftSkills.soft; var si = sList.indexOf(data.skill); if (si === -1) sList.push(data.skill); else sList.splice(si, 1); break; }
      case "redline-edit-toggle-functional": { var fList = S.editingDraftSkills.functional; var fi = fList.indexOf(data.skill); if (fi === -1) fList.push(data.skill); else fList.splice(fi, 1); break; }
      case "redline-edit-save": { var blk2 = findBlock(data.block); blk2.status = "edited"; blk2.soft.final = S.editingDraftSkills.soft.slice(); blk2.functional.final = S.editingDraftSkills.functional.slice(); S.editingBlockId = null; break; }
      case "redline-edit-cancel": S.editingBlockId = null; break;
      case "redline-finish": {
        S.phase = "final";
        if (S.frameworks.length) showToast("Talent Blueprint updated — " + S.frameworks.length + " Skills Framework" + (S.frameworks.length === 1 ? "" : "s") + " left untouched (exempt from LCA).");
        break;
      }

      case "nav-jump": {
        var jumpTo = data.phase;
        if (jumpTo === S.phase) break;
        if (jumpTo !== "redline" && S.checkpoints[jumpTo] === undefined) break;
        if (jumpTo === "redline" && S.blocks.length === 0) break;
        S.editingBlockId = null;

        if (jumpTo === "org") {
          S.log = S.log.slice(0, S.checkpoints.org);
          S.drivers = []; S.bu = []; S.fns = []; S.levels = []; S.fnSkills = {}; S.fnFunctionalSkills = {}; S.blocks = [];
          S.pendingDrivers = []; S.pendingBU = [];
          S.org = null; S.orgTrendingSoft = []; S.orgTrendingFunctional = [];
          S.orgStage = S.orgProfile ? "results" : "lookup";
          S.phase = "org";
        } else if (jumpTo === "drivers") {
          S.log = S.log.slice(0, S.checkpoints.drivers);
          S.pendingDrivers = S.drivers.map(function (d) { return d.name; });
          S.drivers = []; S.bu = []; S.fns = []; S.levels = []; S.fnSkills = {}; S.fnFunctionalSkills = {}; S.blocks = [];
          S.phase = "drivers";
        } else if (jumpTo === "bu") {
          S.log = S.log.slice(0, S.checkpoints.bu);
          S.pendingBU = S.bu.map(function (b) { return b.name; });
          S.bu = []; S.fns = []; S.levels = []; S.fnSkills = {}; S.fnFunctionalSkills = {}; S.blocks = [];
          S.phase = "bu";
        } else if (jumpTo === "functions") {
          S.log = S.log.slice(0, S.checkpoints.functions);
          S.pendingFnNamesByBu = {};
          S.bu.forEach(function (bu) {
            S.pendingFnNamesByBu[bu.id] = S.fns.filter(function (f) { return f.buId === bu.id; }).map(function (f) { return f.name; });
          });
          S.fns = []; S.levels = []; S.fnSkills = {}; S.fnFunctionalSkills = {}; S.blocks = [];
          S.phase = "functions";
        } else if (jumpTo === "levels") {
          S.log = S.log.slice(0, S.checkpoints.levels);
          S.levels = []; S.fnSkills = {}; S.fnFunctionalSkills = {}; S.blocks = [];
          S.phase = "levels";
        } else if (jumpTo === "skills") {
          // BU/level/function entities keep their ids across this jump, and
          // every skills screen now mutates S.buSkills/levelSkills/fnSkills
          // directly (no pending/staging) — so there's nothing to hydrate,
          // every skill assignment at every layer is simply still there.
          S.log = S.log.slice(0, S.checkpoints.skills);
          S.blocks = [];
          S.skillsStage = "bu";
          S.phase = "skills";
        } else if (jumpTo === "redline") { S.phase = "redline"; }
        break;
      }

      case "final-restart": { uid = 0; replaceStateInPlace(defaultState()); break; }
      case "final-export": exportBlueprint(); return;

      case "transcript-toggle": S.transcriptCollapsed = !S.transcriptCollapsed; break;

      default:
        if (window.handleModuleAction) window.handleModuleAction(action, data, target);
    }
    render();
  }
  window.handleAction = handleAction;

  // ============================================================
  // BOOT + GLOBAL EVENT DELEGATION
  // ============================================================
  loadState();

  document.addEventListener("click", function (e) {
    var target = e.target.closest("[data-action]");
    if (!target) return;
    var action = target.getAttribute("data-action");
    var data = {};
    Array.prototype.forEach.call(target.attributes, function (attr) {
      if (attr.name.indexOf("data-") === 0 && attr.name !== "data-action" && attr.name !== "data-chip-input") {
        data[attr.name.slice(5)] = attr.value;
      }
    });
    handleAction(action, data, target);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var target = e.target.closest("[data-chip-input]");
    if (!target) return;
    e.preventDefault();
    var buKey = target.getAttribute("data-bu");
    if (buKey !== null) addChipFor(S.pendingFnNamesByBu, buKey, target.value);
    else addChip(target.getAttribute("data-key"), target.value);
    render();
    var again = document.getElementById(target.id);
    if (again) again.focus();
  });

  window.addEventListener("load", function () { render(); });
  render();
})();
