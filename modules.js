// ============================================================
// MODULES — Org Map, Role Uploader, Skill Discovery, Skills
// Frameworks. Reads/writes the same global `S` and calls the
// same `render()` defined in app.js.
// ============================================================
(function () {
  "use strict";
  var S = window.getS();
  var ic = window.ic, esc = window.esc, nid = window.nid, pushLog = window.pushLog, showToast = window.showToast;

  function truncate(str, n) { return str.length > n ? str.slice(0, n - 1) + "…" : str; }

  // ============================================================
  // ORG MAP
  // ============================================================
  // Builds the shared skill graph (same shape as computeSkillGraph in
  // data.js — skill name -> array of attached entities) from current
  // state, so "how many places does this skill touch" means the same
  // thing here as it does in the Final screen's critical-skills ranking.
  function orgSkillGraph() {
    return computeSkillGraph({
      drivers: S.drivers, bu: S.bu, fns: S.fns, levels: S.levels,
      driverSkills: S.driverSkills, buSkills: S.buSkills,
      fnSkills: S.fnSkills, fnFunctionalSkills: S.fnFunctionalSkills,
      levelSkills: S.levelSkills,
    });
  }

  // A skill is a "hub" once it fans out to this many distinct entities —
  // drawn with emphasis so dense, load-bearing skills read differently
  // from ones attached in a single place.
  var SKILL_HUB_THRESHOLD = 3;

  function computeOrgMapLayout() {
    var driverW = 150, driverH = 42, driverGap = 20;
    var drivers = S.drivers.map(function (d, i) { return { id: d.id, name: d.name, x: 20 + i * (driverW + driverGap), y: 30, w: driverW, h: driverH }; });

    var buW = 172, buH = 46, fnW = 152, fnH = 40, fnGap = 14, buGap = 34;
    var buY = 200, fnY = 330;
    var lvlW = 136, lvlH = 30, lvlGap = 8, lvlStartGap = 20;
    var buNodes = [], fnNodes = [], levelNodes = [], edges = [];
    var cursorX = 20;
    var deepestStackBottom = fnY + fnH;
    S.bu.forEach(function (bu) {
      var fns = S.fns.filter(function (f) { return f.buId === bu.id; });
      var slotWidth = Math.max(buW, fns.length * (fnW + fnGap) - fnGap || buW);
      var buX = cursorX + slotWidth / 2 - buW / 2;
      buNodes.push({ id: bu.id, name: bu.name, x: buX, y: buY, w: buW, h: buH, fnCount: fns.length });
      fns.forEach(function (fn, j) {
        var fx = cursorX + j * (fnW + fnGap);
        var expanded = S.orgmapExpandedFns.indexOf(fn.id) !== -1;
        fnNodes.push({ id: fn.id, name: fn.name, x: fx, y: fnY, w: fnW, h: fnH, buId: bu.id, expanded: expanded });
        var bx = buX + buW / 2, by = buY + buH, midY = by + (fnY - by) / 2;
        edges.push({ d: "M " + bx + " " + by + " V " + midY + " H " + (fx + fnW / 2) + " V " + fnY });

        if (expanded && S.levels.length) {
          var stackStartY = fnY + fnH + lvlStartGap;
          var lx = fx + fnW / 2 - lvlW / 2;
          var stackBottom = stackStartY + S.levels.length * (lvlH + lvlGap) - lvlGap;
          edges.push({ d: "M " + (fx + fnW / 2) + " " + (fnY + fnH) + " V " + stackBottom, spine: true });
          S.levels.forEach(function (level, k) {
            var ly = stackStartY + k * (lvlH + lvlGap);
            var block = S.blocks.filter(function (b) { return b.functionId === fn.id && b.levelId === level.id; })[0];
            levelNodes.push({ fnId: fn.id, levelId: level.id, name: level.name, x: lx, y: ly, w: lvlW, h: lvlH, status: block ? block.status : null });
          });
          deepestStackBottom = Math.max(deepestStackBottom, stackBottom);
        }
      });
      cursorX += slotWidth + buGap;
    });

    // Skills layer — a bipartite band below the structural tree: one
    // node per skill, laid out in a simple wrapped grid (not a real
    // force-directed layout — this is a prototype), with straight edges
    // fanning up to every entity node currently on screen that uses it.
    // Role-level attachments connect to every *expanded* level node
    // sharing that level id, since levelSkills apply org-wide and more
    // than one function can be expanded to the same level at once.
    var skillNodes = [], skillEdges = [];
    var graph = orgSkillGraph();
    var skillNames = Object.keys(graph);
    var skillCols = skillNames.length ? Math.max(3, Math.min(7, Math.ceil(Math.sqrt(skillNames.length)) + 1)) : 0;
    if (S.orgmapShowSkills && skillNames.length) {
      var skW = 182, skH = 34, skGapX = 18, skGapY = 16;
      var bandTop = deepestStackBottom + 60;
      var cols = skillCols;

      var posByKey = {};
      drivers.forEach(function (d) { posByKey["driver:" + d.id] = { x: d.x + d.w / 2, y: d.y + d.h / 2 }; });
      buNodes.forEach(function (b) { posByKey["bu:" + b.id] = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
      fnNodes.forEach(function (f) { posByKey["function:" + f.id] = { x: f.x + f.w / 2, y: f.y + f.h / 2 }; });

      skillNames.forEach(function (name, i) {
        var row = Math.floor(i / cols), col = i % cols;
        var count = graph[name].length;
        skillNodes.push({
          name: name, count: count, attachments: graph[name],
          x: 20 + col * (skW + skGapX), y: bandTop + row * (skH + skGapY), w: skW, h: skH,
          hub: count >= SKILL_HUB_THRESHOLD,
        });
      });

      skillNodes.forEach(function (sk) {
        sk.attachments.forEach(function (a) {
          if (a.type === "level") {
            levelNodes.forEach(function (l) {
              if (l.levelId === a.id) skillEdges.push({ x1: sk.x + sk.w / 2, y1: sk.y, x2: l.x + l.w / 2, y2: l.y + l.h });
            });
          } else {
            var pos = posByKey[a.type + ":" + a.id];
            if (pos) skillEdges.push({ x1: sk.x + sk.w / 2, y1: sk.y, x2: pos.x, y2: pos.y });
          }
        });
      });

      var skillRows = Math.ceil(skillNames.length / cols);
      deepestStackBottom = bandTop + skillRows * (skH + skGapY) - skGapY;
    }

    var contentW = Math.max(cursorX, drivers.length * (driverW + driverGap), skillNodes.length ? skillCols * 200 : 0) + 40;
    var contentH = deepestStackBottom + 50;
    return {
      drivers: drivers, buNodes: buNodes, fnNodes: fnNodes, levelNodes: levelNodes, edges: edges,
      skillNodes: skillNodes, skillEdges: skillEdges, skillCount: skillNames.length,
      contentW: contentW, contentH: contentH,
    };
  }

  function badgeSvg(x, y, count) {
    return '<circle class="orgmap-badge-bg" cx="' + x + '" cy="' + y + '" r="9"/><text class="orgmap-badge-text" x="' + x + '" y="' + (y + 3) + '" text-anchor="middle">' + count + "</text>";
  }

  // Small expand/collapse caret, its own click target nested inside the
  // function node group — a caret pointing down invites "expand", up means
  // "collapse". Positioned bottom-right so it never collides with the
  // skill-count badge (top-right).
  function expandToggleSvg(fn) {
    var cx = fn.w - 2, cy = fn.h + 2;
    var caret = fn.expanded ? "M -3.5 1.5 L 0 -1.5 L 3.5 1.5" : "M -3.5 -1.5 L 0 1.5 L 3.5 -1.5";
    return (
      '<g class="orgmap-expand-toggle" data-action="orgmap-toggle-expand" data-id="' + fn.id + '" transform="translate(' + cx + "," + cy + ')">' +
      '<circle class="expand-toggle-bg" r="9"/>' +
      '<path d="' + caret + '" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</g>"
    );
  }

  var STATUS_LABEL = { pending: "Pending review", approved: "Approved", edited: "Edited & approved", rejected: "Rejected" };

  function renderOrgMap() {
    var isHeatmap = S.orgmapMode === "heatmap";
    var out = '<div class="section-head"><div><h1>Org Map</h1><p>' +
      (isHeatmap
        ? "A density view of skill coverage across every function and role level. Click a cell to jump to its detail on the network view."
        : "Zoom and pan across your strategic drivers, business units, and functions. Click a function's " + ic("expand") + " toggle to reveal its role levels, switch on the skills layer to see the ontology as a graph, or click any node for detail.") +
      "</p></div></div>";
    if (S.bu.length === 0) {
      out += '<div class="empty-state">Your org map will appear here once you\'ve added business units in the Talent Blueprint.<br/><br/><button class="btn-primary" data-action="section-switch" data-section="blueprint">Go to Blueprint ' + ic("arrow") + "</button></div>";
      return out;
    }

    out += '<div class="skill-tabs" style="margin-bottom:16px;">';
    out += '<button class="skill-tab ' + (isHeatmap ? "" : "active") + '" data-action="orgmap-mode-switch" data-mode="graph">Network</button>';
    out += '<button class="skill-tab ' + (isHeatmap ? "active" : "") + '" data-action="orgmap-mode-switch" data-mode="heatmap">Heatmap</button>';
    out += "</div>";

    if (isHeatmap) return out + renderOrgMapHeatmap();

    var layout = computeOrgMapLayout();

    out += '<div class="orgmap-toolbar">';
    out += '<div class="orgmap-legend"><span><span class="legend-swatch driver"></span>Strategic driver</span><span><span class="legend-swatch bu"></span>Business unit</span><span><span class="legend-swatch fn"></span>Function</span><span><span class="legend-swatch level"></span>Role level</span><span><span class="legend-swatch skill"></span>Skill</span></div>';
    out += '<div class="orgmap-controls">';
    out += '<button class="icon-btn ' + (S.orgmapShowSkills ? "active" : "") + '" data-action="orgmap-toggle-skills-layer">' + ic("spark") + " Skills layer (" + layout.skillCount + ")</button>";
    out += '<button class="icon-btn" data-action="orgmap-zoom" data-dir="out" title="Zoom out">' + ic("minus") + "</button>";
    out += '<button class="icon-btn" data-action="orgmap-zoom" data-dir="in" title="Zoom in">' + ic("plus") + "</button>";
    out += '<button class="icon-btn" data-action="orgmap-fit">' + ic("fit") + " Fit</button>";
    out += '<button class="icon-btn" data-action="orgmap-reset">' + ic("reset") + " Reset</button>";
    out += "</div></div>";

    out += '<div class="orgmap-canvas-wrap" id="orgmap-wrap">';
    out += '<svg class="orgmap-svg" id="orgmap-svg"><g id="orgmap-viewport" transform="translate(' + S.orgmapView.x + "," + S.orgmapView.y + ") scale(" + S.orgmapView.scale + ')">';

    layout.edges.forEach(function (e) { out += '<path class="edge-line' + (e.spine ? " spine" : "") + '" d="' + e.d + '"/>'; });
    layout.skillEdges.forEach(function (e) { out += '<path class="edge-line skill-edge" d="M ' + e.x1 + " " + e.y1 + " L " + e.x2 + " " + e.y2 + '"/>'; });

    layout.drivers.forEach(function (d) {
      var selected = S.orgmapSelected && S.orgmapSelected.type === "driver" && S.orgmapSelected.id === d.id;
      var skillCount = (S.driverSkills[d.id] || []).length;
      out += '<g class="orgmap-node" data-action="orgmap-select" data-kind="driver" data-id="' + d.id + '" transform="translate(' + d.x + "," + d.y + ')">';
      out += '<rect class="node-rect driver' + (selected ? " selected" : "") + '" width="' + d.w + '" height="' + d.h + '" rx="' + d.h / 2 + '"/>';
      out += '<text class="node-label" x="' + d.w / 2 + '" y="' + (d.h / 2 + 4) + '" text-anchor="middle">' + esc(truncate(d.name, 20)) + "</text>";
      if (skillCount > 0) out += badgeSvg(d.w - 6, -4, skillCount);
      out += "</g>";
    });

    layout.buNodes.forEach(function (b) {
      var selected = S.orgmapSelected && S.orgmapSelected.type === "bu" && S.orgmapSelected.id === b.id;
      var skillCount = (S.buSkills[b.id] || []).length;
      out += '<g class="orgmap-node" data-action="orgmap-select" data-kind="bu" data-id="' + b.id + '" transform="translate(' + b.x + "," + b.y + ')">';
      out += '<rect class="node-rect bu' + (selected ? " selected" : "") + '" width="' + b.w + '" height="' + b.h + '"/>';
      out += '<text class="node-label" x="' + b.w / 2 + '" y="' + (b.h / 2) + '" text-anchor="middle">' + esc(truncate(b.name, 18)) + "</text>";
      out += '<text class="node-sub" x="' + b.w / 2 + '" y="' + (b.h / 2 + 14) + '" text-anchor="middle">' + b.fnCount + " function" + (b.fnCount === 1 ? "" : "s") + "</text>";
      if (skillCount > 0) out += badgeSvg(b.w - 6, -4, skillCount);
      out += "</g>";
    });

    layout.fnNodes.forEach(function (f) {
      var selected = S.orgmapSelected && S.orgmapSelected.type === "function" && S.orgmapSelected.id === f.id;
      var softN = (S.fnSkills[f.id] || []).length, funcN = (S.fnFunctionalSkills[f.id] || []).length;
      var roleN = S.uploader.uploadedRoles.filter(function (r) { return r.functionId === f.id; }).length;
      out += '<g class="orgmap-node" data-action="orgmap-select" data-kind="function" data-id="' + f.id + '" transform="translate(' + f.x + "," + f.y + ')">';
      out += '<rect class="node-rect fn' + (selected ? " selected" : "") + (f.expanded ? " expanded" : "") + '" width="' + f.w + '" height="' + f.h + '"/>';
      out += '<text class="node-label" x="' + f.w / 2 + '" y="' + (f.h / 2) + '" text-anchor="middle">' + esc(truncate(f.name, 18)) + "</text>";
      out += '<text class="node-sub" x="' + f.w / 2 + '" y="' + (f.h / 2 + 13) + '" text-anchor="middle">' + S.levels.length + " levels" + (roleN ? " · " + roleN + " roles" : "") + "</text>";
      if (softN + funcN > 0) out += badgeSvg(f.w - 6, -4, softN + funcN);
      out += expandToggleSvg(f);
      out += "</g>";
    });

    layout.levelNodes.forEach(function (l) {
      var selected = S.orgmapSelected && S.orgmapSelected.type === "block" && S.orgmapSelected.fnId === l.fnId && S.orgmapSelected.levelId === l.levelId;
      out += '<g class="orgmap-node" data-action="orgmap-select" data-kind="block" data-fn="' + l.fnId + '" data-level="' + l.levelId + '" transform="translate(' + l.x + "," + l.y + ')">';
      out += '<rect class="node-rect level' + (selected ? " selected" : "") + (l.status ? " status-" + l.status : "") + '" width="' + l.w + '" height="' + l.h + '"/>';
      out += '<text class="node-label level-label" x="' + l.w / 2 + '" y="' + (l.h / 2 + 4) + '" text-anchor="middle">' + esc(truncate(l.name, 16)) + "</text>";
      out += "</g>";
    });

    layout.skillNodes.forEach(function (sk) {
      var selected = S.orgmapSelected && S.orgmapSelected.type === "skill" && S.orgmapSelected.name === sk.name;
      out += '<g class="orgmap-node" data-action="orgmap-select" data-kind="skill" data-id="' + esc(sk.name) + '" transform="translate(' + sk.x + "," + sk.y + ')">';
      out += '<title>' + esc(sk.name) + " · " + sk.count + " place" + (sk.count === 1 ? "" : "s") + "</title>";
      out += '<rect class="node-rect skill' + (selected ? " selected" : "") + (sk.hub ? " hub" : "") + '" width="' + sk.w + '" height="' + sk.h + '" rx="' + sk.h / 2 + '"/>';
      out += '<text class="node-label" x="' + sk.w / 2 + '" y="' + (sk.h / 2 + 4) + '" text-anchor="middle">' + esc(truncate(sk.name, 22)) + "</text>";
      out += badgeSvg(sk.w - 4, 2, sk.count);
      out += "</g>";
    });

    out += "</g></svg>";
    if (S.orgmapSelected) out += renderOrgMapDetail(S.orgmapSelected);
    out += "</div>";
    return out;
  }

  // ── Heatmap view: functions x role levels, density/status at a glance ──
  function renderOrgMapHeatmap() {
    if (!S.levels.length) {
      return '<div class="empty-state">Add role levels in the Talent Blueprint to see the heatmap — it needs a shared level framework to build its columns.</div>';
    }
    var out = '<div class="heatmap-legend">' +
      '<span><span class="heatmap-legend-swatch" style="background:var(--surface-2);"></span>Not yet benchmarked</span>' +
      '<span><span class="heatmap-legend-swatch" style="background:rgba(var(--caution-rgb),0.5);"></span>Pending review</span>' +
      '<span><span class="heatmap-legend-swatch" style="background:rgba(var(--success-rgb),0.5);"></span>Approved</span>' +
      '<span><span class="heatmap-legend-swatch" style="background:rgba(var(--warn-rgb),0.5);"></span>Rejected</span>' +
      "</div>";

    out += '<div class="heatmap-scroll">';
    S.bu.forEach(function (bu) {
      var fns = S.fns.filter(function (f) { return f.buId === bu.id; });
      if (!fns.length) return;
      out += '<div class="heatmap-group"><div class="heatmap-group-title">' + esc(bu.name) + "</div>";
      out += '<div class="heatmap-table" style="grid-template-columns: 160px repeat(' + S.levels.length + ', 1fr);">';
      out += '<div></div>';
      S.levels.forEach(function (level) { out += '<div class="heatmap-header">' + esc(truncate(level.name, 16)) + "</div>"; });

      fns.forEach(function (fn) {
        out += '<div class="heatmap-row-label" title="' + esc(fn.name) + '">' + esc(fn.name) + "</div>";
        S.levels.forEach(function (level) {
          var block = S.blocks.filter(function (b) { return b.functionId === fn.id && b.levelId === level.id; })[0];
          var count, status, title;
          if (block) {
            count = block.soft.final.length + block.functional.final.length;
            status = block.status;
            title = fn.name + " · " + level.name + " · " + STATUS_LABEL[block.status];
          } else {
            count = (S.fnSkills[fn.id] || []).length + (S.fnFunctionalSkills[fn.id] || []).length;
            status = "unbenchmarked";
            title = fn.name + " · " + level.name + " · not yet benchmarked";
          }
          out += '<button class="heatmap-cell status-' + status + '" data-action="heatmap-cell-select" data-fn="' + fn.id + '" data-level="' + level.id + '" title="' + esc(title) + '">' + count + "</button>";
        });
      });
      out += "</div></div>";
    });
    out += "</div>";
    return out;
  }

  function renderOrgMapDetail(sel) {
    var out = '<div class="orgmap-detail"><button class="orgmap-detail-close" data-action="orgmap-deselect">' + ic("x") + "</button>";
    if (sel.type === "driver") {
      var d = S.drivers.filter(function (x) { return x.id === sel.id; })[0];
      if (!d) return "";
      var dSkills = S.driverSkills[d.id] || [];
      out += '<div class="kind">Strategic driver</div><h4>' + esc(d.name) + "</h4>";
      out += '<div class="orgmap-detail-row"><b>' + dSkills.length + "</b> skill" + (dSkills.length === 1 ? "" : "s") + " assigned</div>";
      if (dSkills.length) out += '<div class="pill-grid">' + dSkills.map(function (s) { return '<span class="sk">' + esc(s) + "</span>"; }).join("") + "</div>";
      else out += '<div class="orgmap-detail-row" style="color:var(--text-hint);">Use Skill Discovery to assign skills here from a strategy document.</div>';
    } else if (sel.type === "bu") {
      var bu = S.bu.filter(function (x) { return x.id === sel.id; })[0];
      if (!bu) return "";
      var fns = S.fns.filter(function (f) { return f.buId === bu.id; });
      var buSk = S.buSkills[bu.id] || [];
      out += '<div class="kind">Business unit</div><h4>' + esc(bu.name) + "</h4>";
      out += '<div class="orgmap-detail-row"><b>' + fns.length + "</b> function" + (fns.length === 1 ? "" : "s") + ": " + fns.map(function (f) { return esc(f.name); }).join(", ") + "</div>";
      out += '<div class="orgmap-detail-row"><b>' + buSk.length + "</b> unit-level skill" + (buSk.length === 1 ? "" : "s") + (buSk.length ? ": " + buSk.map(esc).join(", ") : "") + "</div>";
    } else if (sel.type === "function") {
      var fn = S.fns.filter(function (x) { return x.id === sel.id; })[0];
      if (!fn) return "";
      var buOf = S.bu.filter(function (x) { return x.id === fn.buId; })[0];
      var soft = S.fnSkills[fn.id] || [], func = S.fnFunctionalSkills[fn.id] || [];
      var roles = S.uploader.uploadedRoles.filter(function (r) { return r.functionId === fn.id; });
      out += '<div class="kind">Function · ' + esc(buOf ? buOf.name : "") + "</div><h4>" + esc(fn.name) + "</h4>";
      out += '<div class="orgmap-detail-row"><b>Soft:</b> ' + (soft.map(esc).join(", ") || "—") + "</div>";
      out += '<div class="orgmap-detail-row"><b>Functional:</b> ' + (func.map(esc).join(", ") || "—") + "</div>";
      out += '<div class="orgmap-detail-row"><b>' + roles.length + "</b> uploaded role" + (roles.length === 1 ? "" : "s") + "</div>";
      out += '<div class="orgmap-detail-row" style="color:var(--text-hint);">Use the ' + ic("expand") + " toggle on this node to see its role levels.</div>";
    } else if (sel.type === "block") {
      var f2 = S.fns.filter(function (x) { return x.id === sel.fnId; })[0];
      var level = S.levels.filter(function (x) { return x.id === sel.levelId; })[0];
      if (!f2 || !level) return "";
      var block = S.blocks.filter(function (b) { return b.functionId === f2.id && b.levelId === level.id; })[0];
      out += '<div class="kind">Role level · ' + esc(f2.name) + "</div><h4>" + esc(level.name) + "</h4>";
      if (block) {
        out += '<div class="orgmap-detail-row"><span class="badge ' + block.status + '">' + STATUS_LABEL[block.status] + "</span></div>";
        if (block.sources.bu.length) out += '<div class="orgmap-detail-row"><b>From BU:</b> ' + block.sources.bu.map(esc).join(", ") + "</div>";
        if (block.sources.level.length) out += '<div class="orgmap-detail-row"><b>From level:</b> ' + block.sources.level.map(esc).join(", ") + "</div>";
        out += '<div class="orgmap-detail-row"><b>Soft (combined):</b> ' + (block.soft.final.map(esc).join(", ") || "—") + "</div>";
        out += '<div class="orgmap-detail-row"><b>Functional:</b> ' + (block.functional.final.map(esc).join(", ") || "—") + "</div>";
        out += '<div class="orgmap-detail-row">Benchmarked vs ' + block.sampleSize.toLocaleString() + " postings · " + block.confidence + "% confidence</div>";
      } else {
        var fSoft = S.fnSkills[f2.id] || [], fFunc = S.fnFunctionalSkills[f2.id] || [];
        out += '<div class="orgmap-detail-row" style="color:var(--text-hint);">Not yet aligned to market data — run the Blueprint\'s Market Redline step to benchmark this level.</div>';
        out += '<div class="orgmap-detail-row"><b>Soft (function-wide):</b> ' + (fSoft.map(esc).join(", ") || "—") + "</div>";
        out += '<div class="orgmap-detail-row"><b>Functional (function-wide):</b> ' + (fFunc.map(esc).join(", ") || "—") + "</div>";
      }
    } else if (sel.type === "skill") {
      var graph = orgSkillGraph();
      var attachments = graph[sel.name] || [];
      out += '<div class="kind">Skill · ' + (isOntologySkill(sel.name) ? "Fuel50 Ontology" : "Client Skills Inventory") + "</div><h4>" + esc(sel.name) + "</h4>";
      out += '<div class="orgmap-detail-row"><b>' + attachments.length + "</b> place" + (attachments.length === 1 ? "" : "s") + " in your architecture" + (attachments.length >= SKILL_HUB_THRESHOLD ? " — a hub skill" : "") + "</div>";
      ["driver", "bu", "function", "level"].forEach(function (type) {
        var names = attachments.filter(function (a) { return a.type === type; }).map(function (a) { return a.name; });
        if (names.length) out += '<div class="orgmap-detail-row"><b>' + esc(ENTITY_TYPE_LABEL[type]) + "s:</b> " + names.map(esc).join(", ") + "</div>";
      });
    }
    out += "</div>";
    return out;
  }

  window.renderOrgMap = renderOrgMap;

  window.wireOrgMapInteractions = function () {
    var wrap = document.getElementById("orgmap-wrap");
    if (!wrap) return;
    function apply() {
      var vp = document.getElementById("orgmap-viewport");
      if (vp) vp.setAttribute("transform", "translate(" + S.orgmapView.x + "," + S.orgmapView.y + ") scale(" + S.orgmapView.scale + ")");
    }
    var drag = null;
    wrap.addEventListener("pointerdown", function (e) {
      // Don't start a pan (and don't capture the pointer) when the press
      // starts on a node or the expand toggle — setPointerCapture redirects
      // the resulting click's target to `wrap` itself, which would swallow
      // clicks on anything inside the canvas before they ever reach the
      // [data-action] delegation in app.js.
      if (e.target.closest("[data-action]")) return;
      drag = { x: e.clientX, y: e.clientY, ox: S.orgmapView.x, oy: S.orgmapView.y };
      wrap.setPointerCapture(e.pointerId);
      wrap.classList.add("grabbing");
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!drag) return;
      S.orgmapView.x = drag.ox + (e.clientX - drag.x);
      S.orgmapView.y = drag.oy + (e.clientY - drag.y);
      apply();
    });
    function endDrag() { drag = null; wrap.classList.remove("grabbing"); }
    wrap.addEventListener("pointerup", endDrag);
    wrap.addEventListener("pointercancel", endDrag);
    wrap.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var rect = wrap.getBoundingClientRect();
        var mx = e.clientX - rect.left, my = e.clientY - rect.top;
        var view = S.orgmapView, oldScale = view.scale;
        var newScale = Math.min(2.4, Math.max(0.3, oldScale * (e.deltaY < 0 ? 1.12 : 0.89)));
        view.x = mx - (mx - view.x) * (newScale / oldScale);
        view.y = my - (my - view.y) * (newScale / oldScale);
        view.scale = newScale;
        apply();
      },
      { passive: false }
    );
  };

  // ============================================================
  // ROLE UPLOADER
  // ============================================================
  function toTitleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function matchTaxonomy(value, existingNames) {
    if (!value) return { status: "missing" };
    if (existingNames.length === 0) return { status: "new" };
    var lower = value.trim().toLowerCase();
    var exact = existingNames.filter(function (n) { return n.toLowerCase() === lower; })[0];
    if (exact) return { status: "ok", name: exact };
    var fuzzy = existingNames.filter(function (n) { return n.toLowerCase().indexOf(lower) !== -1 || lower.indexOf(n.toLowerCase()) !== -1; })[0];
    if (fuzzy) return { status: "fuzzy", name: fuzzy };
    return { status: "unrecognized" };
  }

  function validateRows(rows) {
    var seenTitles = {};
    rows.forEach(function (row, i) {
      row.issues = [];
      var normTitle = (row.title || "").trim().toLowerCase();
      if (!row.title.trim()) row.issues.push({ level: "error", message: "Missing role title" });
      if (!row.fn.trim()) row.issues.push({ level: "error", message: "Missing function" });
      if (!row.level.trim()) row.issues.push({ level: "error", message: "Missing level" });

      if (row.origTitle !== row.origTitle.trim() || (row.origTitle.length > 3 && row.origTitle === row.origTitle.toUpperCase())) {
        row.issues.push({ level: "info", code: "format", message: "Non-standard formatting — auto-fixable" });
      }
      if (normTitle && seenTitles[normTitle] !== undefined && !row.excluded) {
        row.issues.push({ level: "warn", code: "dup", message: "Duplicate of row #" + (seenTitles[normTitle] + 1) + " — consider merging", firstIndex: seenTitles[normTitle] });
      }
      if (normTitle && seenTitles[normTitle] === undefined) seenTitles[normTitle] = i;

      if (row.bu.trim()) {
        var buMatch = matchTaxonomy(row.bu, S.bu.map(function (b) { return b.name; }));
        if (buMatch.status === "fuzzy") row.issues.push({ level: "warn", code: "bu", message: 'Close to existing "' + buMatch.name + '"', suggestion: buMatch.name });
        else if (buMatch.status === "unrecognized") row.issues.push({ level: "warn", code: "bu", message: "Unrecognized business unit — will create new, or map below" });
        else if (buMatch.status === "new") row.issues.push({ level: "info", code: "bu-new", message: 'Will create new business unit "' + row.bu.trim() + '"' });
      }
      if (row.fn.trim()) {
        var fnMatch = matchTaxonomy(row.fn, S.fns.map(function (f) { return f.name; }));
        if (fnMatch.status === "fuzzy") row.issues.push({ level: "warn", code: "fn", message: 'Close to existing "' + fnMatch.name + '"', suggestion: fnMatch.name });
        else if (fnMatch.status === "unrecognized") row.issues.push({ level: "warn", code: "fn", message: "Unrecognized function — will create new, or map below" });
        else if (fnMatch.status === "new") row.issues.push({ level: "info", code: "fn-new", message: 'Will create new function "' + row.fn.trim() + '"' });
      }
      if (row.level.trim() && S.levels.length) {
        var lvMatch = matchTaxonomy(row.level, S.levels.map(function (l) { return l.name; }));
        if (lvMatch.status === "fuzzy") row.issues.push({ level: "warn", code: "level", message: 'Close to existing "' + lvMatch.name + '"', suggestion: lvMatch.name });
        else if (lvMatch.status === "unrecognized") row.issues.push({ level: "warn", code: "level", message: "Unrecognized level — map below" });
      }
    });
    return rows;
  }

  function rowsFromRecords(records) {
    return records.map(function (rec, i) {
      var title = rec["Role Title"] || rec["role title"] || "";
      return {
        id: nid("uprow"),
        origTitle: title,
        title: title.trim(),
        bu: (rec["Business Unit"] || "").trim(),
        fn: (rec["Function"] || "").trim(),
        level: (rec["Level"] || "").trim(),
        excluded: false,
        issues: [],
      };
    });
  }

  function loadCSVText(text, fileName) {
    var parsed = parseCSV(text);
    S.uploader.fileName = fileName;
    S.uploader.rows = validateRows(rowsFromRecords(parsed.records));
  }

  function renderUploader() {
    var out = '<div class="section-head"><div><h1>Role Uploader</h1><p>Upload a role export, review data-quality issues, and cleanse before committing to your Talent Blueprint.</p></div></div>';
    var u = S.uploader;

    if (!u.rows.length) {
      out += '<div class="dropzone" id="up-dropzone" data-action="up-pick-file">';
      out += ic("upload") + "<div style=\"margin-top:8px;\">Drop a CSV of roles here, or click to choose a file</div>";
      out += '<div style="font-size:11px;margin-top:4px;">Expected columns: Role Title, Business Unit, Function, Level</div>';
      out += '<input type="file" id="up-file-input" accept=".csv,text/csv" />';
      out += "</div>";
      out += '<div class="actions" style="border-top:none;margin-top:14px;padding-top:0;justify-content:flex-start;"><button class="btn-ghost" data-action="up-load-sample">' + ic("file") + " Load sample role export</button></div>";
      if (u.uploadedRoles.length) out += renderUploaderCommittedSummary();
      return out;
    }

    var errCount = 0, warnCount = 0, infoCount = 0;
    u.rows.forEach(function (r) {
      if (r.excluded) return;
      r.issues.forEach(function (iss) { if (iss.level === "error") errCount++; else if (iss.level === "warn") warnCount++; else infoCount++; });
    });
    var blockingRows = u.rows.filter(function (r) { return !r.excluded && r.issues.some(function (i) { return i.level === "error"; }); }).length;

    out += '<div class="panel"><div class="panel-title">Source</div>' + ic("file") + " " + esc(u.fileName || "Untitled") + " · " + u.rows.length + " rows</div>";

    out += '<div class="qc-summary">';
    out += '<div class="stat"><div class="num mono">' + errCount + '</div><div class="lbl">Errors</div></div>';
    out += '<div class="stat"><div class="num mono warn">' + warnCount + '</div><div class="lbl">Warnings</div></div>';
    out += '<div class="stat"><div class="num mono">' + infoCount + '</div><div class="lbl">Auto-fixable</div></div>';
    out += "</div>";

    out += '<div class="actions" style="border-top:none;padding-top:0;margin-top:0 0 14px;">';
    out += '<button class="btn-ghost" data-action="up-autofix-all">' + ic("spark") + " Auto-fix all formatting</button>";
    out += '<button class="btn-ghost" data-action="up-clear">' + ic("reset") + " Start over</button>";
    out += "</div>";

    out += '<div class="table-scroll"><table class="role-table"><thead><tr><th>Role title</th><th>Business unit</th><th>Function</th><th>Level</th><th>Issues</th><th></th></tr></thead><tbody>';
    u.rows.forEach(function (row, i) {
      out += '<tr class="' + (row.excluded ? "excluded" : "") + '">';
      out += "<td>" + esc(row.title || "—") + (row.excluded ? ' <span style="color:var(--graphite-soft);font-size:10.5px;">(excluded' + (row.mergedNote ? ": " + esc(row.mergedNote) : "") + ")</span>" : "") + "</td>";
      out += "<td>" + esc(row.bu || "—") + "</td>";
      out += "<td>" + esc(row.fn || "—") + "</td>";
      out += "<td>" + esc(row.level || "—") + "</td>";
      out += '<td><div class="row-issues">';
      row.issues.forEach(function (iss) {
        out += '<div class="issue ' + iss.level + '">' + (iss.level === "error" ? ic("alert") : iss.level === "warn" ? ic("alert") : ic("spark")) + " " + esc(iss.message) + "</div>";
      });
      out += "</div>";
      if (!row.excluded) {
        var fixes = "";
        if (row.issues.some(function (x) { return x.code === "format"; })) fixes += '<button class="btn-ghost btn-small" data-action="up-autofix" data-row="' + row.id + '">Auto-fix</button>';
        row.issues.forEach(function (iss) {
          if (iss.suggestion) fixes += '<button class="btn-ghost btn-small" data-action="up-map" data-row="' + row.id + '" data-field="' + iss.code + '" data-value="' + esc(iss.suggestion) + '">Map to "' + esc(iss.suggestion) + '"</button>';
          if (iss.code === "dup") fixes += '<button class="btn-ghost btn-small" data-action="up-merge" data-row="' + row.id + '" data-first="' + iss.firstIndex + '">Merge into #' + (iss.firstIndex + 1) + "</button>";
        });
        if (fixes) out += '<div class="row-fix">' + fixes + "</div>";
      }
      out += "</td>";
      out += "<td>" + (row.excluded ? '<button class="btn-text" data-action="up-restore" data-row="' + row.id + '">Restore</button>' : '<button class="btn-text" data-action="up-exclude" data-row="' + row.id + '">Exclude</button>') + "</td>";
      out += "</tr>";
    });
    out += "</tbody></table></div>";

    out += '<div class="actions">';
    out += "<span style=\"font-size:11.5px;color:var(--graphite-soft);\">" + (blockingRows > 0 ? blockingRows + " row" + (blockingRows === 1 ? "" : "s") + " still blocked by errors" : "All rows clear to upload") + "</span>";
    out += '<button class="btn-primary" data-action="up-commit" ' + (blockingRows > 0 ? "disabled" : "") + ">" + ic("check") + " Upload roles to Blueprint</button>";
    out += "</div>";

    if (u.uploadedRoles.length) out += renderUploaderCommittedSummary();
    return out;
  }

  function renderUploaderCommittedSummary() {
    var u = S.uploader;
    return '<div class="panel" style="margin-top:16px;"><div class="panel-title">Previously uploaded</div>' + u.uploadedRoles.length + " role" + (u.uploadedRoles.length === 1 ? "" : "s") + " committed to the Blueprint — visible on the Org Map under their mapped function.</div>";
  }

  window.renderUploader = renderUploader;

  function commitUpload() {
    var u = S.uploader;
    var toCommit = u.rows.filter(function (r) { return !r.excluded; });
    var created = 0;
    toCommit.forEach(function (row) {
      var bu = S.bu.filter(function (b) { return b.name.toLowerCase() === row.bu.trim().toLowerCase(); })[0];
      if (!bu && row.bu.trim()) { bu = { id: nid("bu"), name: row.bu.trim() }; S.bu.push(bu); created++; }
      var fn = null;
      if (bu) {
        fn = S.fns.filter(function (f) { return f.buId === bu.id && f.name.toLowerCase() === row.fn.trim().toLowerCase(); })[0];
        if (!fn && row.fn.trim()) { fn = { id: nid("fn"), buId: bu.id, name: row.fn.trim() }; S.fns.push(fn); created++; }
      }
      u.uploadedRoles.push({ id: nid("role"), title: row.title, buId: bu ? bu.id : null, functionId: fn ? fn.id : null, level: row.level });
    });
    var committedCount = toCommit.length;
    u.rows = []; u.fileName = null;
    showToast(committedCount + " role" + (committedCount === 1 ? "" : "s") + " uploaded" + (created ? " · " + created + " new taxonomy entries created" : "") + ".");
  }

  // ============================================================
  // SKILL DISCOVERY
  // ============================================================
  var TARGET_TYPES = [
    { key: "driver", label: "Strategic Driver" },
    { key: "bu", label: "Business Unit" },
    { key: "function", label: "Function" },
    { key: "level", label: "Role Level" },
  ];
  function targetEntities(type) {
    if (type === "driver") return S.drivers;
    if (type === "bu") return S.bu;
    if (type === "function") return S.fns;
    if (type === "level") return S.levels;
    return [];
  }
  function targetSkillMap(type) {
    if (type === "driver") return S.driverSkills;
    if (type === "bu") return S.buSkills;
    if (type === "level") return S.levelSkills;
    return null; // function is split soft/functional, handled separately
  }

  function renderDiscovery() {
    var d = S.discovery;
    var out = '<div class="section-head"><div><h1>Skill Discovery</h1><p>Upload a strategy, competency, or organisational document. AI suggests relevant skills from the Fuel50 Skills Ontology, or proposes new entries for your own Skills Inventory.</p></div></div>';

    out += '<div class="panel"><div class="panel-title">1. Choose what you\'re tagging</div><div class="target-grid">';
    TARGET_TYPES.forEach(function (t) {
      out += '<button class="target-type ' + (d.targetType === t.key ? "active" : "") + '" data-action="disc-target-type" data-type="' + t.key + '">' + esc(t.label) + "</button>";
    });
    out += "</div>";

    var entities = targetEntities(d.targetType);
    if (!entities.length) {
      out += '<div class="empty-state" style="margin-top:10px;">No ' + TARGET_TYPES.filter(function (t) { return t.key === d.targetType; })[0].label.toLowerCase() + "s yet — add some in the Talent Blueprint first.</div>";
      return out;
    }
    out += '<div class="chips" style="margin-top:10px;">';
    entities.forEach(function (e) {
      var active = d.targetId === e.id;
      out += '<button class="chip" style="' + (active ? "" : "background:none;color:var(--graphite-soft);border-color:var(--border-strong);") + '" data-action="disc-target-entity" data-id="' + e.id + '">' + esc(e.name) + "</button>";
    });
    out += "</div></div>";

    if (!d.targetId) return out;
    var entity = entities.filter(function (e) { return e.id === d.targetId; })[0];
    if (!entity) return out;

    out += '<div class="panel"><div class="panel-title">2. Bring a document</div>';
    out += '<div class="dropzone" id="disc-dropzone" data-action="disc-pick-file">' + ic("upload") + '<div style="margin-top:8px;">Drop a .txt document here, or click to choose a file</div><input type="file" id="disc-file-input" accept=".txt,.md,text/plain" /></div>';
    out += '<div class="sample-doc-list">';
    SAMPLE_DOCUMENTS.forEach(function (doc, i) {
      out += '<button class="sample-doc" data-action="disc-load-sample" data-index="' + i + '">' + ic("file") + " " + esc(doc.name) + "</button>";
    });
    out += "</div>";
    if (d.docName) {
      out += '<div style="margin-top:10px;font-size:12px;"><b>' + esc(d.docName) + "</b></div>";
      if (d.docText) out += '<div class="doc-text-preview">' + esc(d.docText.slice(0, 400)) + (d.docText.length > 400 ? "…" : "") + "</div>";
      out += '<div class="actions" style="border-top:none;padding-top:12px;"><span></span><button class="btn-primary" data-action="disc-analyze">' + ic("spark") + " Analyze document</button></div>";
    }
    out += "</div>";

    if (d.analysis) {
      out += '<div class="panel"><div class="panel-title">3. Review AI-suggested skills for "' + esc(entity.name) + '"</div>';
      out += '<div class="suggestion-cols">';
      out += '<div class="suggestion-col"><h4>From Fuel50 Skills Ontology</h4>';
      if (!d.analysis.ontology.length) out += '<div style="font-size:12px;color:var(--graphite-soft);">No ontology matches found.</div>';
      d.analysis.ontology.forEach(function (s) {
        out += '<label class="suggestion-check"><input type="checkbox" ' + (d.checked[s] !== false ? "checked" : "") + ' data-action="disc-toggle" data-skill="' + esc(s) + '"/>' + esc(s) + "</label>";
      });
      out += "</div>";
      out += '<div class="suggestion-col"><h4>New — add to Skills Inventory</h4>';
      if (!d.analysis.inventory.length) out += '<div style="font-size:12px;color:var(--graphite-soft);">No new candidates found.</div>';
      d.analysis.inventory.forEach(function (s) {
        out += '<label class="suggestion-check"><input type="checkbox" ' + (d.checked[s] !== false ? "checked" : "") + ' data-action="disc-toggle" data-skill="' + esc(s) + '"/>' + esc(s) + ' <span style="font-size:10px;color:var(--graphite-soft);">(new)</span></label>';
      });
      out += "</div></div>";
      var checkedCount = d.analysis.ontology.concat(d.analysis.inventory).filter(function (s) { return d.checked[s] !== false; }).length;
      out += '<div class="actions"><span></span><button class="btn-primary" data-action="disc-assign" ' + (checkedCount ? "" : "disabled") + ">" + ic("check") + " Assign " + checkedCount + " skill" + (checkedCount === 1 ? "" : "s") + ' to "' + esc(entity.name) + '"</button></div>';
      out += "</div>";
    }

    var existing = d.targetType === "function" ? (S.fnSkills[entity.id] || []).concat(S.fnFunctionalSkills[entity.id] || []) : (targetSkillMap(d.targetType)[entity.id] || []);
    if (existing.length) {
      out += '<div class="panel"><div class="panel-title">Currently assigned to "' + esc(entity.name) + '"</div><div class="pill-grid">' + existing.map(function (s) { return '<span class="sk">' + esc(s) + "</span>"; }).join("") + "</div></div>";
    }
    return out;
  }
  window.renderDiscovery = renderDiscovery;

  function runAnalysis() {
    var d = S.discovery;
    var text = d.docText || d.docName || "";
    d.analysis = analyzeDocumentText(text);
    d.checked = {};
  }

  function assignDiscoverySkills() {
    var d = S.discovery;
    if (!d.analysis) return;
    var chosen = d.analysis.ontology.concat(d.analysis.inventory).filter(function (s) { return d.checked[s] !== false; });
    if (!chosen.length) return;
    chosen.forEach(function (s) { if (!isOntologySkill(s) && S.skillsInventory.indexOf(s) === -1) S.skillsInventory.push(s); });

    if (d.targetType === "function") {
      var soft = S.fnSkills[d.targetId] || (S.fnSkills[d.targetId] = []);
      var func = S.fnFunctionalSkills[d.targetId] || (S.fnFunctionalSkills[d.targetId] = []);
      chosen.forEach(function (s) {
        var bucket = ALL_FUNCTIONAL_SKILLS.indexOf(s) !== -1 ? func : soft;
        if (bucket.indexOf(s) === -1) bucket.push(s);
      });
    } else {
      var map = targetSkillMap(d.targetType);
      var list = map[d.targetId] || (map[d.targetId] = []);
      chosen.forEach(function (s) { if (list.indexOf(s) === -1) list.push(s); });
    }
    var entity = targetEntities(d.targetType).filter(function (e) { return e.id === d.targetId; })[0];
    showToast(chosen.length + " skill" + (chosen.length === 1 ? "" : "s") + " assigned to " + (entity ? entity.name : "target") + ".");
    d.docName = null; d.docText = ""; d.analysis = null; d.checked = {};
  }

  // ============================================================
  // SKILLS FRAMEWORKS
  // ============================================================
  function defaultProficiencyScale() {
    return [
      { level: 1, label: "Aware", description: "" },
      { level: 2, label: "Developing", description: "" },
      { level: 3, label: "Skilled", description: "" },
      { level: 4, label: "Advanced", description: "" },
      { level: 5, label: "Expert", description: "" },
    ];
  }

  function renderFrameworks() {
    var out = '<div class="section-head"><div><h1>Skills Frameworks</h1><p>A client-facing workspace where Fuel50 and your team create, review, and maintain skills frameworks together — exempt from the automated market-alignment engine (LCA), with proficiency you control.</p></div></div>';
    out += '<div class="panel"><div class="panel-title">' + ic("shield", 16) + " Governance</div>";
    out += '<div style="font-size:12.5px;color:var(--graphite-soft);line-height:1.6;">Frameworks marked <b style="color:var(--ink);">exempt from LCA</b> are never touched by a Talent Blueprint update — market redlining does not run against them, and their proficiency scale is set and owned by you. Turn exemption off only if you want a framework to be kept in sync with market data like the rest of the Blueprint.</div></div>';

    out += '<div class="actions" style="border-top:none;padding-top:0;justify-content:flex-start;margin-bottom:14px;"><button class="btn-primary" data-action="fw-new">' + ic("plus") + " New framework</button></div>";

    if (!S.frameworks.length) {
      out += '<div class="empty-state">No skills frameworks yet. Create one to define client-specific skills and proficiency, independent of the Talent Blueprint.</div>';
      return out;
    }

    S.frameworks.forEach(function (fw) { out += renderFrameworkCard(fw); });

    if (S.skillsInventory.length) {
      out += '<div class="panel"><div class="panel-title">Your Skills Inventory (client-defined)</div><div class="pill-grid">' + S.skillsInventory.map(function (s) { return '<span class="sk">' + esc(s) + "</span>"; }).join("") + "</div></div>";
    }
    return out;
  }
  window.renderFrameworks = renderFrameworks;

  function renderFrameworkCard(fw) {
    var editing = S.editingFrameworkId === fw.id;
    var out = '<div class="framework-card">';
    out += '<div class="framework-head"><div><div class="framework-name">' + esc(fw.name) + '</div><div class="framework-desc">' + esc(fw.description || "No description yet.") + "</div></div>";
    out += '<div style="display:flex;align-items:center;gap:8px;">';
    out += '<span class="exempt-badge ' + (fw.exempt ? "" : "off") + '">' + ic("lock") + (fw.exempt ? " Exempt from LCA" : " Included in LCA") + "</span>";
    out += '<button class="icon-btn" data-action="fw-edit" data-id="' + fw.id + '">' + (editing ? ic("x") + " Close" : ic("pencil") + " Edit") + "</button>";
    out += '<button class="icon-btn reject" data-action="fw-delete" data-id="' + fw.id + '">' + ic("x") + " Delete</button>";
    out += "</div></div>";

    out += '<div class="framework-body">';
    if (!editing) {
      out += '<div class="skillset-label">Proficiency scale</div><div class="pill-grid" style="margin-bottom:10px;">';
      fw.scale.forEach(function (lvl) { out += '<span class="sk">' + lvl.level + " · " + esc(lvl.label) + "</span>"; });
      out += "</div>";
      out += '<div class="skillset-label">Skills (' + fw.skills.length + ")</div><div class=\"pill-grid\">";
      fw.skills.forEach(function (s) { out += '<span class="sk">' + esc(s) + "</span>"; });
      out += "</div>";
      out += '<div class="stamp-line"><span>Owner: <b>' + esc(fw.owner) + "</b></span><span>Last reviewed: <b>" + esc(fw.lastReviewed) + "</b></span></div>";
    } else {
      out += renderFrameworkEditor(fw);
    }
    out += "</div></div>";
    return out;
  }

  function renderFrameworkEditor(fw) {
    var out = "";
    out += '<div class="input-row"><input type="text" id="fw-name-' + fw.id + '" value="' + esc(fw.name) + '" placeholder="Framework name"/></div>';
    out += '<div class="input-row"><textarea id="fw-desc-' + fw.id + '" rows="2" placeholder="What is this framework for?">' + esc(fw.description) + "</textarea></div>";

    out += '<div class="skillset-label">Proficiency scale — you own the definitions</div><div class="prof-scale">';
    fw.scale.forEach(function (lvl) {
      out += '<div class="prof-row"><div class="prof-num mono">' + lvl.level + '</div><input class="label-input" id="fw-lvl-label-' + fw.id + "-" + lvl.level + '" value="' + esc(lvl.label) + '" placeholder="Label"/><input id="fw-lvl-desc-' + fw.id + "-" + lvl.level + '" value="' + esc(lvl.description) + '" placeholder="What does this level look like?"/></div>';
    });
    out += "</div>";

    out += '<div class="skillset-label">Skills</div>';
    if (S.fwPendingSkills.length) {
      out += '<div class="chips">';
      S.fwPendingSkills.forEach(function (s) { out += '<span class="chip">' + esc(s) + '<button data-action="fw-remove-skill" data-skill="' + esc(s) + '">' + ic("x") + "</button></span>"; });
      out += "</div>";
    }
    out += '<div class="input-row"><input type="text" id="fw-skill-input" placeholder="Type a custom skill, or pick a suggestion below" data-fw-skill-input/>';
    out += '<button class="btn-add" data-action="fw-add-skill">' + ic("plus") + " Add</button></div>";
    var suggestions = SOFT_SKILLS.concat(ALL_FUNCTIONAL_SKILLS).filter(function (s) { return S.fwPendingSkills.indexOf(s) === -1; }).slice(0, 10);
    out += '<div class="chips">';
    suggestions.forEach(function (s) { out += '<button class="suggestion" data-action="fw-add-skill-suggestion" data-skill="' + esc(s) + '">+ ' + esc(s) + "</button>"; });
    out += "</div>";

    out += '<div class="actions"><button class="btn-ghost" data-action="fw-toggle-exempt" data-id="' + fw.id + '">' + ic("lock") + " " + (fw.exempt ? "Turn off LCA exemption" : "Mark exempt from LCA") + "</button><button class=\"btn-primary\" data-action=\"fw-save\" data-id=\"" + fw.id + '">' + ic("check") + " Save framework</button></div>";
    return out;
  }

  // ============================================================
  // MODULE ACTION HANDLER
  // ============================================================
  window.handleModuleAction = function (action, data, target) {
    switch (action) {
      // Org Map
      case "orgmap-select": {
        var next = data.kind === "block" ? { type: "block", fnId: data.fn, levelId: data.level }
          : data.kind === "skill" ? { type: "skill", name: data.id }
          : { type: data.kind, id: data.id };
        S.orgmapSelected = S.orgmapSelected && JSON.stringify(S.orgmapSelected) === JSON.stringify(next) ? null : next;
        return true;
      }
      case "orgmap-deselect": S.orgmapSelected = null; return true;
      case "orgmap-toggle-expand": {
        var idx = S.orgmapExpandedFns.indexOf(data.id);
        if (idx === -1) S.orgmapExpandedFns.push(data.id); else S.orgmapExpandedFns.splice(idx, 1);
        return true;
      }
      case "orgmap-toggle-skills-layer": S.orgmapShowSkills = !S.orgmapShowSkills; return true;
      case "orgmap-mode-switch": S.orgmapMode = data.mode; S.orgmapSelected = null; return true;
      case "heatmap-cell-select": {
        // Drill from the overview lens into the network lens, already
        // expanded and selected at the exact function/level the cell
        // represents — overview-to-detail in one click.
        S.orgmapMode = "graph";
        if (S.orgmapExpandedFns.indexOf(data.fn) === -1) S.orgmapExpandedFns.push(data.fn);
        S.orgmapSelected = { type: "block", fnId: data.fn, levelId: data.level };
        return true;
      }
      case "goto-skill-in-map": {
        S.section = "orgmap";
        S.orgmapMode = "graph";
        S.orgmapShowSkills = true;
        S.orgmapSelected = { type: "skill", name: data.skill };
        return true;
      }
      case "orgmap-zoom": {
        var wrap = document.getElementById("orgmap-wrap");
        var cx = wrap ? wrap.clientWidth / 2 : 300, cy = wrap ? wrap.clientHeight / 2 : 200;
        var view = S.orgmapView;
        var newScale = Math.min(2.4, Math.max(0.3, view.scale * (data.dir === "in" ? 1.2 : 0.8)));
        view.x = cx - (cx - view.x) * (newScale / view.scale);
        view.y = cy - (cy - view.y) * (newScale / view.scale);
        view.scale = newScale;
        return true;
      }
      case "orgmap-fit": {
        var layout = computeOrgMapLayout();
        var wrap2 = document.getElementById("orgmap-wrap");
        var cw = wrap2 ? wrap2.clientWidth : 800, ch = wrap2 ? wrap2.clientHeight : 500;
        var scale = Math.min(cw / layout.contentW, ch / layout.contentH, 1.4) * 0.94;
        S.orgmapView = { x: (cw - layout.contentW * scale) / 2, y: 12, scale: scale };
        return true;
      }
      case "orgmap-reset": S.orgmapView = { x: 40, y: 20, scale: 1 }; return true;

      // Role Uploader
      case "up-pick-file": { var fi = document.getElementById("up-file-input"); if (fi) fi.click(); return true; }
      case "up-load-sample": { loadCSVText(SAMPLE_ROLE_CSV, "sample-role-export.csv"); return true; }
      case "up-clear": S.uploader.rows = []; S.uploader.fileName = null; return true;
      case "up-autofix": { var row = S.uploader.rows.filter(function (r) { return r.id === data.row; })[0]; if (row) { row.title = toTitleCase(row.title.trim().replace(/\s+/g, " ")); row.origTitle = row.title; } S.uploader.rows = validateRows(S.uploader.rows); return true; }
      case "up-autofix-all": {
        S.uploader.rows.forEach(function (r) {
          if (r.issues.some(function (x) { return x.code === "format"; })) { r.title = toTitleCase(r.title.trim().replace(/\s+/g, " ")); r.origTitle = r.title; }
        });
        S.uploader.rows = validateRows(S.uploader.rows);
        return true;
      }
      case "up-map": { var r2 = S.uploader.rows.filter(function (x) { return x.id === data.row; })[0]; if (r2) r2[data.field] = data.value; S.uploader.rows = validateRows(S.uploader.rows); return true; }
      case "up-merge": { var r3 = S.uploader.rows.filter(function (x) { return x.id === data.row; })[0]; if (r3) { r3.excluded = true; r3.mergedNote = "merged into row #" + (parseInt(data.first, 10) + 1); } S.uploader.rows = validateRows(S.uploader.rows); return true; }
      case "up-exclude": { var r4 = S.uploader.rows.filter(function (x) { return x.id === data.row; })[0]; if (r4) { r4.excluded = true; r4.mergedNote = null; } S.uploader.rows = validateRows(S.uploader.rows); return true; }
      case "up-restore": { var r5 = S.uploader.rows.filter(function (x) { return x.id === data.row; })[0]; if (r5) { r5.excluded = false; r5.mergedNote = null; } S.uploader.rows = validateRows(S.uploader.rows); return true; }
      case "up-commit": commitUpload(); return true;

      // Skill Discovery
      case "disc-target-type": S.discovery.targetType = data.type; S.discovery.targetId = null; S.discovery.analysis = null; return true;
      case "disc-target-entity": S.discovery.targetId = data.id; S.discovery.analysis = null; S.discovery.docName = null; S.discovery.docText = ""; return true;
      case "disc-pick-file": { var dfi = document.getElementById("disc-file-input"); if (dfi) dfi.click(); return true; }
      case "disc-load-sample": { var doc = SAMPLE_DOCUMENTS[parseInt(data.index, 10)]; if (doc) { S.discovery.docName = doc.name; S.discovery.docText = doc.text; S.discovery.analysis = null; } return true; }
      case "disc-analyze": runAnalysis(); return true;
      case "disc-toggle": S.discovery.checked[data.skill] = S.discovery.checked[data.skill] === false ? true : false; return true;
      case "disc-assign": assignDiscoverySkills(); return true;

      // Skills Frameworks
      case "fw-new": {
        var fw = { id: nid("fw"), name: "Untitled Framework", description: "", exempt: true, scale: defaultProficiencyScale(), skills: [], owner: "Shared (Fuel50 + Client)", lastReviewed: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) };
        S.frameworks.unshift(fw);
        S.editingFrameworkId = fw.id;
        S.fwPendingSkills = [];
        return true;
      }
      case "fw-edit": {
        if (S.editingFrameworkId === data.id) { S.editingFrameworkId = null; }
        else { var fwEd = S.frameworks.filter(function (f) { return f.id === data.id; })[0]; S.editingFrameworkId = data.id; S.fwPendingSkills = fwEd ? fwEd.skills.slice() : []; }
        return true;
      }
      case "fw-delete": { if (confirm("Delete this skills framework? This cannot be undone.")) S.frameworks = S.frameworks.filter(function (f) { return f.id !== data.id; }); return true; }
      case "fw-add-skill": { var inp = document.getElementById("fw-skill-input"); var v = inp ? inp.value.trim() : ""; if (v && S.fwPendingSkills.indexOf(v) === -1) S.fwPendingSkills.push(v); return true; }
      case "fw-add-skill-suggestion": if (S.fwPendingSkills.indexOf(data.skill) === -1) S.fwPendingSkills.push(data.skill); return true;
      case "fw-remove-skill": S.fwPendingSkills = S.fwPendingSkills.filter(function (s) { return s !== data.skill; }); return true;
      case "fw-toggle-exempt": { var fwT = S.frameworks.filter(function (f) { return f.id === data.id; })[0]; if (fwT) fwT.exempt = !fwT.exempt; return true; }
      case "fw-save": {
        var fwS = S.frameworks.filter(function (f) { return f.id === data.id; })[0];
        if (fwS) {
          var nameEl = document.getElementById("fw-name-" + fwS.id), descEl = document.getElementById("fw-desc-" + fwS.id);
          fwS.name = nameEl ? nameEl.value.trim() || "Untitled Framework" : fwS.name;
          fwS.description = descEl ? descEl.value.trim() : fwS.description;
          fwS.scale.forEach(function (lvl) {
            var labelEl = document.getElementById("fw-lvl-label-" + fwS.id + "-" + lvl.level);
            var descLvlEl = document.getElementById("fw-lvl-desc-" + fwS.id + "-" + lvl.level);
            if (labelEl) lvl.label = labelEl.value.trim() || lvl.label;
            if (descLvlEl) lvl.description = descLvlEl.value.trim();
          });
          fwS.skills = S.fwPendingSkills.slice();
          fwS.skills.forEach(function (s) { if (!isOntologySkill(s) && S.skillsInventory.indexOf(s) === -1) S.skillsInventory.push(s); });
          fwS.lastReviewed = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        }
        S.editingFrameworkId = null;
        showToast("Framework saved — proficiency stays client-controlled" + (fwS && fwS.exempt ? " and exempt from LCA." : "."));
        return true;
      }
    }
    return false;
  };

  // ── File input + drag/drop wiring (delegated, survives re-renders) ──
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "up-file-input" && e.target.files[0]) {
      var f = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function () { loadCSVText(String(reader.result), f.name); window.render(); };
      reader.readAsText(f);
    }
    if (e.target && e.target.id === "disc-file-input" && e.target.files[0]) {
      var f2 = e.target.files[0];
      var reader2 = new FileReader();
      reader2.onload = function () { S.discovery.docName = f2.name; S.discovery.docText = String(reader2.result); S.discovery.analysis = null; window.render(); };
      reader2.readAsText(f2);
    }
  });

  document.addEventListener("dragover", function (e) {
    if (e.target.closest && (e.target.closest("#up-dropzone") || e.target.closest("#disc-dropzone"))) {
      e.preventDefault();
      e.target.closest(".dropzone").classList.add("dragging");
    }
  });
  document.addEventListener("dragleave", function (e) {
    if (e.target.closest && e.target.closest(".dropzone")) e.target.closest(".dropzone").classList.remove("dragging");
  });
  document.addEventListener("drop", function (e) {
    var zone = e.target.closest && (e.target.closest("#up-dropzone") || e.target.closest("#disc-dropzone"));
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragging");
    var file = e.dataTransfer.files[0];
    if (!file) return;
    var reader = new FileReader();
    if (zone.id === "up-dropzone") {
      reader.onload = function () { loadCSVText(String(reader.result), file.name); window.render(); };
    } else {
      reader.onload = function () { S.discovery.docName = file.name; S.discovery.docText = String(reader.result); S.discovery.analysis = null; window.render(); };
    }
    reader.readAsText(file);
  });
})();
