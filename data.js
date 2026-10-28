// ============================================================
// DATA — catalogs, category heuristics, and pure helper functions.
// No DOM access lives in this file; app.js and modules.js consume it.
// ============================================================

// ── Strategic drivers ───────────────────────────────────────────────────
var SUGGESTED_DRIVERS = [
  "Customer Obsession",
  "Operational Excellence",
  "Innovation & Growth",
  "Digital Transformation",
  "Talent & Culture",
  "Sustainability & Risk",
  "Market Expansion",
];

// ── Business units ──────────────────────────────────────────────────────
var SUGGESTED_BUS = ["Engineering & Technology", "Product", "Sales & Marketing", "Customer Success", "People & Talent", "Finance & Operations", "Legal & Compliance"];

var FUNCTION_SUGGESTIONS = [
  { re: /engineer|technolog|it\b/i, list: ["Software Engineering", "Platform & Infrastructure", "Quality Engineering", "Data & Analytics", "Security"] },
  { re: /product/i, list: ["Product Management", "UX Research", "Product Design"] },
  { re: /sales|marketing/i, list: ["Sales", "Marketing", "Sales Operations", "Customer Marketing"] },
  { re: /customer|support/i, list: ["Customer Success", "Support", "Implementation"] },
  { re: /people|talent|hr\b/i, list: ["Talent Acquisition", "Learning & Development", "HR Business Partnering", "Compensation & Benefits"] },
  { re: /finance|operations/i, list: ["Finance", "Accounting", "Procurement", "Business Operations"] },
  { re: /legal|compliance/i, list: ["Legal", "Compliance", "Risk Management"] },
];
var DEFAULT_FN_SUGGESTIONS = ["Operations", "Strategy", "Administration"];
function suggestFunctionsFor(name) {
  for (var i = 0; i < FUNCTION_SUGGESTIONS.length; i++) if (FUNCTION_SUGGESTIONS[i].re.test(name)) return FUNCTION_SUGGESTIONS[i].list;
  return DEFAULT_FN_SUGGESTIONS;
}

// ── Role level templates ────────────────────────────────────────────────
var LEVEL_TEMPLATES = {
  "Standard 5-level": [
    { id: "lvl-1", name: "Foundational", tier: 1 },
    { id: "lvl-2", name: "Practitioner", tier: 1 },
    { id: "lvl-3", name: "Senior", tier: 2 },
    { id: "lvl-4", name: "Lead / Expert", tier: 3 },
    { id: "lvl-5", name: "Principal / Director", tier: 4 },
  ],
  "IC + Manager track": [
    { id: "lvl-ic1", name: "IC1 — Associate", tier: 1 },
    { id: "lvl-ic2", name: "IC2 — Professional", tier: 1 },
    { id: "lvl-ic3", name: "IC3 — Senior", tier: 2 },
    { id: "lvl-ic4", name: "IC4 — Staff", tier: 3 },
    { id: "lvl-m1", name: "M1 — Manager", tier: 3 },
    { id: "lvl-m2", name: "M2 — Director", tier: 4 },
  ],
};

// ── Skills Ontology: soft skills ────────────────────────────────────────
var SOFT_SKILLS = ["Communication", "Collaboration", "Critical Thinking", "Adaptability", "Problem Solving", "Emotional Intelligence", "Time Management", "Creativity & Innovation", "Negotiation", "Conflict Resolution", "Coaching & Mentoring", "Strategic Thinking", "Influence & Persuasion", "Resilience", "Customer Focus", "Active Listening", "Decision Making", "Attention to Detail", "Cross-functional Collaboration", "Data Storytelling", "Change Management", "Stakeholder Management", "Executive Presence"];

// ── Skills Ontology: functional skills, by category ─────────────────────
var FUNCTIONAL_SKILLS_BY_CATEGORY = {
  technical: ["Cloud Infrastructure (AWS/Azure/GCP)", "CI/CD Pipelines", "System Design", "Test Automation", "API Development", "Data Modeling"],
  sales: ["Pipeline Forecasting", "CRM Administration", "Solution Selling", "Contract Negotiation", "Territory Planning"],
  product: ["Product Analytics", "Roadmap Prioritization", "Usability Testing", "A/B Testing", "Wireframing & Prototyping"],
  people: ["HRIS Administration", "Compensation Benchmarking", "Applicant Tracking Systems", "Workforce Planning", "Employee Relations Case Management"],
  finance: ["Financial Modeling", "GAAP/IFRS Reporting", "Budget Variance Analysis", "ERP Systems (SAP/Oracle)", "Procurement Contracts"],
  customer: ["Ticketing System Administration", "Customer Health Scoring", "Renewal & Upsell Process", "Root-Cause Analysis"],
  legal: ["Contract Drafting", "Regulatory Filings", "IP Portfolio Management", "Litigation Support"],
  general: ["Process Documentation", "Vendor Management", "Reporting & Dashboards"],
};
var ALL_FUNCTIONAL_SKILLS = Array.prototype.concat.apply([], Object.keys(FUNCTIONAL_SKILLS_BY_CATEGORY).map(function (k) { return FUNCTIONAL_SKILLS_BY_CATEGORY[k]; }));

function isOntologySkill(name) {
  return SOFT_SKILLS.indexOf(name) !== -1 || ALL_FUNCTIONAL_SKILLS.indexOf(name) !== -1;
}

// ── Category heuristics (shared by soft + functional suggestion) ───────
var CATEGORY_MATCHERS = [
  { re: /engineer|infrastructure|security|quality|data & analytics|it\b/i, cat: "technical" },
  { re: /sales|marketing/i, cat: "sales" },
  { re: /product|design|research/i, cat: "product" },
  { re: /talent|hr\b|learning|compensation|people/i, cat: "people" },
  { re: /finance|accounting|procurement|operations/i, cat: "finance" },
  { re: /customer|support|implementation/i, cat: "customer" },
  { re: /legal|compliance|risk/i, cat: "legal" },
];
function categoryFor(name) {
  for (var i = 0; i < CATEGORY_MATCHERS.length; i++) if (CATEGORY_MATCHERS[i].re.test(name)) return CATEGORY_MATCHERS[i].cat;
  return "general";
}
var CATEGORY_BASE_SKILLS = {
  technical: ["Problem Solving", "Critical Thinking", "Attention to Detail", "Collaboration", "Adaptability"],
  sales: ["Negotiation", "Influence & Persuasion", "Communication", "Resilience", "Customer Focus"],
  product: ["Creativity & Innovation", "Critical Thinking", "Cross-functional Collaboration", "Data Storytelling"],
  people: ["Emotional Intelligence", "Coaching & Mentoring", "Conflict Resolution", "Active Listening"],
  finance: ["Attention to Detail", "Critical Thinking", "Time Management", "Decision Making"],
  customer: ["Customer Focus", "Active Listening", "Communication", "Conflict Resolution"],
  legal: ["Attention to Detail", "Critical Thinking", "Decision Making", "Stakeholder Management"],
  general: ["Communication", "Collaboration", "Adaptability", "Problem Solving"],
};
var CATEGORY_MARKET_POOL = {
  technical: ["Communication", "Time Management", "Decision Making", "Data Storytelling"],
  sales: ["Stakeholder Management", "Data Storytelling", "Adaptability"],
  product: ["Communication", "Stakeholder Management", "Strategic Thinking", "Influence & Persuasion"],
  people: ["Communication", "Stakeholder Management", "Change Management"],
  finance: ["Data Storytelling", "Stakeholder Management", "Communication"],
  customer: ["Resilience", "Adaptability", "Data Storytelling"],
  legal: ["Communication", "Negotiation", "Change Management"],
  general: ["Time Management", "Decision Making"],
};
var TIER_BONUS_SKILLS = {
  1: [],
  2: ["Time Management", "Decision Making"],
  3: ["Coaching & Mentoring", "Stakeholder Management", "Influence & Persuasion"],
  4: ["Strategic Thinking", "Executive Presence", "Change Management"],
};
var COMPARABLE_PREFIX = { 1: "Associate", 2: "Senior", 3: "Lead", 4: "Principal" };

function suggestSkillsForFunction(name) { return CATEGORY_BASE_SKILLS[categoryFor(name)].slice(); }
function suggestFunctionalSkillsForFunction(name) {
  var cat = categoryFor(name);
  var pool = FUNCTIONAL_SKILLS_BY_CATEGORY[cat] || FUNCTIONAL_SKILLS_BY_CATEGORY.general;
  return pool.slice(0, 3);
}

// A business unit's suggestion blends the categories of the functions
// inside it — a unit that's mostly engineering functions gets a different
// baseline than one that's mostly sales, without asking a separate
// question per function.
function suggestSkillsForBU(bu, allFunctions) {
  var fns = allFunctions.filter(function (f) { return f.buId === bu.id; });
  var cats = [];
  fns.forEach(function (f) { var c = categoryFor(f.name); if (cats.indexOf(c) === -1) cats.push(c); });
  if (!cats.length) cats = ["general"];
  var out = [];
  cats.forEach(function (c) { CATEGORY_BASE_SKILLS[c].forEach(function (s) { if (out.indexOf(s) === -1) out.push(s); }); });
  return out.slice(0, 6);
}

// A role level's suggestion is just its tier bonus — the same skills that
// already get layered on automatically as level tier increases, surfaced
// here so they can be reviewed and edited explicitly rather than only
// appearing invisibly inside the market-redline pass.
function suggestSkillsForLevel(level) {
  var base = TIER_BONUS_SKILLS[level.tier] || [];
  if (level.tier === 1 && base.length === 0) return ["Communication", "Adaptability"];
  return base.slice();
}

// ── Deterministic pseudo-random (stable across re-renders) ──────────────
function seededScore(seed, min, max) {
  var hash = 0;
  for (var i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  var n = (Math.abs(hash) % 1000) / 1000;
  return Math.round(min + n * (max - min));
}

// ── Market redline math — shared by soft + functional passes ────────────
function computeRedline(seedKey, baseSkills, marketPool, tierBonus) {
  var candidatePool = [];
  (marketPool.concat(tierBonus)).forEach(function (s) { if (baseSkills.indexOf(s) === -1 && candidatePool.indexOf(s) === -1) candidatePool.push(s); });
  var addCount = Math.min(candidatePool.length, seededScore(seedKey + "add", 1, 3));
  var added = candidatePool.slice(0, addCount);
  var removed = [];
  if (baseSkills.length > 2 && seededScore(seedKey + "rm", 0, 10) > 7) {
    var idx = seededScore(seedKey + "rmidx", 0, baseSkills.length - 1);
    removed = [baseSkills[idx]];
  }
  var market = [];
  baseSkills.forEach(function (s) { if (removed.indexOf(s) === -1 && market.indexOf(s) === -1) market.push(s); });
  added.forEach(function (s) { if (market.indexOf(s) === -1) market.push(s); });
  var parts = [];
  if (added.length) parts.push(added.join(", ") + (added.length === 1 ? " appears" : " appear") + " in the majority of comparable market postings");
  if (removed.length) parts.push(removed.join(", ") + " shows weak market signal at this level");
  if (!parts.length) parts.push("Your selections already match market expectations closely");
  return { base: baseSkills, market: market, added: added, removed: removed, final: market.slice(), rationale: parts.join(" · ") };
}

// A role sits at the intersection of a business unit, a function, and a
// role level. Its skill set rolls up all three layers — BU-wide skills and
// level-wide skills both fold into the soft-skill base alongside the
// function's own soft skills — before the combined pool is checked against
// market data. Functional (technical) skills stay function-scoped, since
// they don't meaningfully apply "across a whole business unit."
function buildAlignmentBlock(bu, fn, level, baseSoftSkills, baseFunctionalSkills, baseBuSkills, baseLevelSkills) {
  baseBuSkills = baseBuSkills || [];
  baseLevelSkills = baseLevelSkills || [];
  var category = categoryFor(fn.name);
  var seedKey = bu.id + ":" + fn.id + ":" + level.id;
  var rolledSoft = [];
  baseSoftSkills.concat(baseBuSkills, baseLevelSkills).forEach(function (s) { if (rolledSoft.indexOf(s) === -1) rolledSoft.push(s); });
  var soft = computeRedline(seedKey + ":soft", rolledSoft, CATEGORY_MARKET_POOL[category], TIER_BONUS_SKILLS[level.tier]);
  var functionalPool = FUNCTIONAL_SKILLS_BY_CATEGORY[category] || FUNCTIONAL_SKILLS_BY_CATEGORY.general;
  var functional = computeRedline(seedKey + ":func", baseFunctionalSkills, functionalPool, []);
  var confidence = seededScore(seedKey + "conf", 74, 97);
  var sampleSize = seededScore(seedKey + "n", 320, 2400);
  return {
    id: fn.id + "::" + level.id, buId: bu.id, functionId: fn.id, levelId: level.id,
    confidence: confidence, sampleSize: sampleSize,
    comparableTitle: COMPARABLE_PREFIX[level.tier] + " " + fn.name,
    soft: soft, functional: functional,
    sources: { bu: baseBuSkills, level: baseLevelSkills, function: baseSoftSkills },
    status: "pending",
  };
}

// ── Role Uploader: CSV parsing + sample data ─────────────────────────────
// Minimal CSV parser: handles quoted fields with embedded commas/quotes.
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], records: [] };
  var headers = rows[0].map(function (h) { return h.trim(); });
  var records = rows.slice(1).map(function (r) {
    var rec = {};
    headers.forEach(function (h, i) { rec[h] = (r[i] || "").trim(); });
    return rec;
  });
  return { headers: headers, records: records };
}

var SAMPLE_ROLE_CSV =
  "Role Title,Business Unit,Function,Level\n" +
  "Senior Software Engineer,Engineering & Technology,Software Engineering,Senior\n" +
  "senior software engineer ,Engineering & Technology,Software Engineering,Senior\n" +
  "Staff Software Engineer,Engineering & Technology,Software Engineering,Lead / Expert\n" +
  "QA Analyst,Engineering & Technology,Quality Engineering,Practitioner\n" +
  ",Engineering & Technology,Platform & Infra,Senior\n" +
  "Product Manager II,Product,Product Management,Senior\n" +
  "PRODUCT DESIGNER,Product,Product Design,Practitioner\n" +
  "Account Executive,Sales & Marketing,Sales,Senior\n" +
  "Marketing Generalist,Sales & Marketing,Growth Marketing,Foundational\n" +
  "Customer Success Manager,Customer Success,Customer Success,Practitioner\n" +
  "Support Engineer,Customer Success,Support,Foundational\n" +
  "HR Business Partner,People & Talent,HR Business Partnering,Senior\n" +
  "Financial Analyst,Finance & Operations,Finance,Practitioner\n" +
  "Financial Analyst,Finance & Operations,Finance,Practitioner\n";

// ── Skill Discovery: keyword-themed document analysis ────────────────────
// A lightweight stand-in for a real NLP pass: scans document text for
// theme keywords and proposes skills per theme, split into ones already
// in the Fuel50 Skills Ontology vs. new candidates for the client's own
// Skills Inventory.
var DOC_THEMES = [
  { key: "customer", re: /customer|retention|churn|nps|renewal/i, skills: ["Customer Focus", "Active Listening", "Customer Health Scoring"] },
  { key: "growth", re: /growth|expansion|market share|revenue|pipeline/i, skills: ["Strategic Thinking", "Negotiation", "Pipeline Forecasting"] },
  { key: "digital", re: /digital transformation|automation|ai adoption|modern(i|is)ation/i, skills: ["Change Management", "Data Storytelling", "Digital Fluency"] },
  { key: "risk", re: /risk|compliance|regulat|audit/i, skills: ["Attention to Detail", "Decision Making", "Regulatory Filings"] },
  { key: "culture", re: /culture|inclusion|engagement|wellbeing|belonging/i, skills: ["Emotional Intelligence", "Coaching & Mentoring", "Employee Relations Case Management"] },
  { key: "innovation", re: /innovation|experiment|r&d|prototyp/i, skills: ["Creativity & Innovation", "Critical Thinking", "A/B Testing"] },
  { key: "quality", re: /quality|reliability|uptime|incident/i, skills: ["Attention to Detail", "Root-Cause Analysis", "Test Automation"] },
  { key: "leadership", re: /leadership|succession|talent bench|capability/i, skills: ["Executive Presence", "Coaching & Mentoring", "Workforce Planning"] },
];

function analyzeDocumentText(text) {
  var suggestions = [];
  DOC_THEMES.forEach(function (t) {
    if (t.re.test(text)) t.skills.forEach(function (s) { if (suggestions.indexOf(s) === -1) suggestions.push(s); });
  });
  // Always surface at least a small baseline so a thin/short sample document
  // still produces something to review.
  if (suggestions.length < 3) ["Communication", "Strategic Thinking", "Collaboration"].forEach(function (s) { if (suggestions.indexOf(s) === -1) suggestions.push(s); });
  var ontology = suggestions.filter(isOntologySkill);
  var inventory = suggestions.filter(function (s) { return !isOntologySkill(s); });
  return { ontology: ontology, inventory: inventory };
}

var SAMPLE_DOCUMENTS = [
  {
    name: "FY26 Strategy Memo.txt",
    text: "This year our strategy centres on market expansion and revenue growth in existing accounts, paired with a renewed focus on customer retention and reducing churn. We are investing in digital transformation and automation across back-office processes, and expect leaders to strengthen succession planning and our leadership bench as we scale.",
  },
  {
    name: "Engineering Competency Framework.txt",
    text: "Engineering excellence depends on reliability and uptime commitments, disciplined incident response, and a quality-first mindset. We expect strong root-cause analysis skills, investment in test automation, and a culture of experimentation and innovation in how we prototype new platform capability.",
  },
  {
    name: "People & Culture Charter.txt",
    text: "Our people strategy is built on inclusion, belonging and employee wellbeing. We measure engagement quarterly and expect every manager to invest in coaching and the capability of their team, while HR maintains compliance with regulatory and audit obligations across every region we operate in.",
  },
];

// ============================================================
// Organisation Lookup — a simulated Lightcast market-data pull used
// to kick off a blueprint. A real integration would resolve the
// company to a Lightcast "company" record and pull its live job-
// postings index; here an industry is inferred from the org's name
// (editable), and that industry's profile stands in for the market
// data Lightcast would otherwise return — comparable postings,
// trending skills, top titles — all sized with the same seeded
// pseudo-random approach used for the market redline, so results are
// stable for a given org name rather than reshuffling on every view.
// ============================================================

var INDUSTRY_PROFILES = {
  technology: {
    label: "Technology & Software",
    naics: "511210",
    description: "Software publishers and technology-driven product companies — high demand for engineering, product, and data talent.",
    growthRate: 9.2,
    avgSalary: 118000,
    businessUnits: ["Engineering & Technology", "Product", "Sales & Marketing", "Customer Success", "People & Talent"],
    strategicDrivers: ["Digital Transformation", "Innovation & Growth", "Talent & Culture"],
    trendingSoftSkills: ["Problem Solving", "Critical Thinking", "Adaptability", "Collaboration", "Data Storytelling", "Strategic Thinking"],
    trendingFunctionalSkills: ["Cloud Infrastructure (AWS/Azure/GCP)", "CI/CD Pipelines", "System Design", "API Development", "Product Analytics", "Test Automation"],
    topTitles: [
      { title: "Senior Software Engineer", postings: 2400 },
      { title: "Product Manager", postings: 1350 },
      { title: "Data Analyst", postings: 980 },
      { title: "DevOps Engineer", postings: 760 },
      { title: "UX Designer", postings: 540 },
    ],
  },
  financial: {
    label: "Financial Services",
    naics: "522110",
    description: "Banks, asset managers, and fintechs — strong emphasis on risk, compliance, and data-driven decisioning.",
    growthRate: 4.1,
    avgSalary: 108000,
    businessUnits: ["Finance & Operations", "Sales & Marketing", "Legal & Compliance", "Customer Success", "People & Talent"],
    strategicDrivers: ["Operational Excellence", "Sustainability & Risk", "Market Expansion"],
    trendingSoftSkills: ["Attention to Detail", "Critical Thinking", "Decision Making", "Stakeholder Management", "Data Storytelling", "Negotiation"],
    trendingFunctionalSkills: ["Financial Modeling", "GAAP/IFRS Reporting", "Budget Variance Analysis", "Regulatory Filings", "ERP Systems (SAP/Oracle)", "Contract Drafting"],
    topTitles: [
      { title: "Financial Analyst", postings: 1600 },
      { title: "Accountant", postings: 1100 },
      { title: "Relationship Manager", postings: 980 },
      { title: "Compliance Officer", postings: 720 },
      { title: "Risk Analyst", postings: 640 },
    ],
  },
  healthcare: {
    label: "Healthcare & Life Sciences",
    naics: "621111",
    description: "Providers, payers, and life sciences organisations — growing demand for clinical operations and patient-experience roles.",
    growthRate: 6.8,
    avgSalary: 95000,
    businessUnits: ["Customer Success", "People & Talent", "Finance & Operations", "Legal & Compliance", "Engineering & Technology"],
    strategicDrivers: ["Customer Obsession", "Sustainability & Risk", "Talent & Culture"],
    trendingSoftSkills: ["Emotional Intelligence", "Active Listening", "Attention to Detail", "Communication", "Conflict Resolution", "Resilience"],
    trendingFunctionalSkills: ["Regulatory Filings", "Root-Cause Analysis", "HRIS Administration", "Reporting & Dashboards", "Customer Health Scoring", "Process Documentation"],
    topTitles: [
      { title: "Care Coordinator", postings: 1240 },
      { title: "Data Analyst", postings: 610 },
      { title: "Clinical Operations Manager", postings: 540 },
      { title: "Patient Experience Lead", postings: 460 },
      { title: "Compliance Specialist", postings: 380 },
    ],
  },
  retail: {
    label: "Retail & E-commerce",
    naics: "454110",
    description: "Omnichannel retailers and e-commerce brands — fast-moving, customer- and campaign-driven roles.",
    growthRate: 5.4,
    avgSalary: 82000,
    businessUnits: ["Sales & Marketing", "Customer Success", "Finance & Operations", "People & Talent"],
    strategicDrivers: ["Customer Obsession", "Market Expansion", "Innovation & Growth"],
    trendingSoftSkills: ["Customer Focus", "Adaptability", "Communication", "Creativity & Innovation", "Resilience", "Time Management"],
    trendingFunctionalSkills: ["CRM Administration", "Customer Health Scoring", "Pipeline Forecasting", "Reporting & Dashboards", "Vendor Management", "A/B Testing"],
    topTitles: [
      { title: "Customer Experience Associate", postings: 1480 },
      { title: "E-commerce Manager", postings: 860 },
      { title: "Marketing Coordinator", postings: 720 },
      { title: "Store Operations Manager", postings: 590 },
      { title: "Merchandising Analyst", postings: 430 },
    ],
  },
  manufacturing: {
    label: "Manufacturing & Industrial",
    naics: "336110",
    description: "Industrial manufacturers and supply-chain operators — demand concentrated in operations, quality, and procurement.",
    growthRate: 3.6,
    avgSalary: 86000,
    businessUnits: ["Finance & Operations", "Engineering & Technology", "People & Talent", "Sales & Marketing"],
    strategicDrivers: ["Operational Excellence", "Sustainability & Risk", "Innovation & Growth"],
    trendingSoftSkills: ["Attention to Detail", "Problem Solving", "Time Management", "Decision Making", "Collaboration", "Adaptability"],
    trendingFunctionalSkills: ["Vendor Management", "Process Documentation", "Root-Cause Analysis", "ERP Systems (SAP/Oracle)", "Test Automation", "System Design"],
    topTitles: [
      { title: "Operations Manager", postings: 780 },
      { title: "Supply Chain Analyst", postings: 620 },
      { title: "Quality Engineer", postings: 540 },
      { title: "Procurement Specialist", postings: 460 },
      { title: "Plant Supervisor", postings: 390 },
    ],
  },
  "professional-services": {
    label: "Professional & Business Services",
    naics: "541611",
    description: "Consultancies and business-services firms — broad generalist demand across client delivery and operations.",
    growthRate: 5.0,
    avgSalary: 92000,
    businessUnits: ["Sales & Marketing", "People & Talent", "Finance & Operations", "Customer Success"],
    strategicDrivers: ["Customer Obsession", "Talent & Culture", "Market Expansion"],
    trendingSoftSkills: ["Communication", "Collaboration", "Adaptability", "Problem Solving", "Stakeholder Management", "Strategic Thinking"],
    trendingFunctionalSkills: ["Reporting & Dashboards", "Process Documentation", "Vendor Management", "CRM Administration", "Product Analytics", "Financial Modeling"],
    topTitles: [
      { title: "Business Consultant", postings: 880 },
      { title: "Account Manager", postings: 760 },
      { title: "Project Coordinator", postings: 690 },
      { title: "Operations Analyst", postings: 540 },
      { title: "HR Business Partner", postings: 410 },
    ],
  },
};

var INDUSTRY_LIST = Object.keys(INDUSTRY_PROFILES).map(function (key) { return { key: key, label: INDUSTRY_PROFILES[key].label }; });

var INDUSTRY_NAME_MATCHERS = [
  { re: /tech|software|digital|systems|labs|data|cloud|\bai\b|app(s)?\b/i, key: "technology" },
  { re: /bank|capital|financial|invest|insurance|credit|wealth/i, key: "financial" },
  { re: /health|med|pharma|clinic|hospital|bio|care\b/i, key: "healthcare" },
  { re: /retail|commerce|shop|store|market(place)?|brands?\b/i, key: "retail" },
  { re: /manufactur|industrial|motors|materials|energy|supply/i, key: "manufacturing" },
];

// Best-effort guess from company name (and optional domain) alone — a
// stand-in for resolving the org against a real company database. Returns
// null when nothing matches, so the caller can fall back to a default
// rather than claim false confidence.
function detectIndustryFromName(name, domain) {
  var haystack = (name || "") + " " + (domain || "");
  for (var i = 0; i < INDUSTRY_NAME_MATCHERS.length; i++) {
    if (INDUSTRY_NAME_MATCHERS[i].re.test(haystack)) return INDUSTRY_NAME_MATCHERS[i].key;
  }
  return null;
}

function round1(n) { return Math.round(n * 10) / 10; }
function roundToThousand(n) { return Math.round(n / 1000) * 1000; }

// `industryOverride` — pass an INDUSTRY_PROFILES key to force it; pass
// null/"auto" to detect from the name, falling back to "professional-
// services" when detection is inconclusive.
function lookupOrganization(name, domain, industryOverride) {
  var detected = industryOverride && industryOverride !== "auto" ? industryOverride : detectIndustryFromName(name, domain);
  var industryKey = detected && INDUSTRY_PROFILES[detected] ? detected : "professional-services";
  var wasDetected = !industryOverride || industryOverride === "auto";
  var profile = INDUSTRY_PROFILES[industryKey];
  var seed = (name || "").trim().toLowerCase() + ":" + industryKey;

  var postingsAnalyzed = seededScore(seed + ":postings", 8000, 42000);
  var companiesSampled = seededScore(seed + ":companies", 120, 980);
  var growthRate = round1(profile.growthRate + seededScore(seed + ":growth", -15, 15) / 10);
  var avgSalary = roundToThousand(profile.avgSalary + seededScore(seed + ":salary", -8000, 8000));

  var topTitles = profile.topTitles.map(function (t) {
    var lo = Math.round(t.postings * 0.75), hi = Math.round(t.postings * 1.25);
    return { title: t.title, postings: seededScore(seed + ":" + t.title, lo, hi) };
  });

  return {
    industryKey: industryKey,
    industryLabel: profile.label,
    naics: profile.naics,
    description: profile.description,
    wasDetected: wasDetected,
    postingsAnalyzed: postingsAnalyzed,
    companiesSampled: companiesSampled,
    growthRate: growthRate,
    avgSalary: avgSalary,
    businessUnits: profile.businessUnits.slice(),
    strategicDrivers: profile.strategicDrivers.slice(),
    trendingSoftSkills: profile.trendingSoftSkills.slice(),
    trendingFunctionalSkills: profile.trendingFunctionalSkills.slice(),
    topTitles: topTitles,
  };
}

// ============================================================
// Skill Graph — the shared "who touches what" computation behind both
// the Org Map's skills layer and the critical-skills ranking. Walks
// every layer that assigns skills directly (strategic drivers, business
// units, functions, role levels) and returns, per skill name, the list
// of entities attached to it. Deliberately excludes Skills Frameworks —
// those are a separate, client-controlled governance layer exempt from
// the main ontology, consistent with the TBP/LCA separation elsewhere.
// Pure function: takes explicit data, never touches global state, so
// both app.js and modules.js can call it with whatever slice of `S`
// they need.
// ============================================================
function computeSkillGraph(args) {
  var graph = {}; // skillName -> array of { type, id, name }
  function attach(skillName, type, id, name) {
    var list = graph[skillName] || (graph[skillName] = []);
    if (!list.some(function (a) { return a.type === type && a.id === id; })) list.push({ type: type, id: id, name: name });
  }
  (args.drivers || []).forEach(function (d) {
    (args.driverSkills[d.id] || []).forEach(function (s) { attach(s, "driver", d.id, d.name); });
  });
  (args.bu || []).forEach(function (b) {
    (args.buSkills[b.id] || []).forEach(function (s) { attach(s, "bu", b.id, b.name); });
  });
  (args.fns || []).forEach(function (f) {
    (args.fnSkills[f.id] || []).forEach(function (s) { attach(s, "function", f.id, f.name); });
    (args.fnFunctionalSkills[f.id] || []).forEach(function (s) { attach(s, "function", f.id, f.name); });
  });
  (args.levels || []).forEach(function (l) {
    (args.levelSkills[l.id] || []).forEach(function (s) { attach(s, "level", l.id, l.name); });
  });
  return graph;
}

var ENTITY_TYPE_LABEL = { driver: "strategic driver", bu: "business unit", function: "function", level: "role level" };
