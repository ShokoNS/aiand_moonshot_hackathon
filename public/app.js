const DEMO_APPLICATION = {
  id: "SDS-2026-0148",
  company: "ネクストパルス株式会社",
  department: "事業開発部",
  contactName: "佐藤 美咲",
  contactKana: "さとう みさき",
  phone: "03-0000-0148",
  email: "misaki.sato@example.com",
  organizer: "ネクストパルス株式会社",
  coOrganizer: "なし",
  purpose: "ピッチイベント / 交流会",
  deeptechArea: "AIと機械学習",
  eventType: "ハイブリッド開催",
  participation: "公募イベント",
  title: "AI Startup Partnership Night",
  firstDate: "2026-09-17",
  secondDate: "2026-09-24",
  startTime: "17:00",
  endTime: "21:00",
  attendeeCount: 80,
  fee: "無料",
  language: "日本語と英語",
  interpretation: "通訳あり",
  attendees: "起業家 / スタートアップ / 大企業 / 金融機関・VC",
  details: "AIスタートアップと事業会社が、現場の課題と実証可能性を共有する夕方のピッチ＆ネットワーキングです。8社のショートピッチと、テーマ別の少人数セッションを予定しています。",
  equipment: "あり",
  food: "飲食提供あり",
  discovery: "ご紹介",
  setupTime: "準備90分・撤去45分",
  alcohol: "未定",
  sdsSupport: "会員向け告知 / 登壇者候補の紹介 / 企画内容の共同設計",
};

let CASES = [
  { id: "SDS-2026-0148", title: "AI Startup Partnership Night", company: "ネクストパルス株式会社", status: "企画面談候補 / Planning candidate", color: "coral", date: "9月17日", application: DEMO_APPLICATION },
  { id: "SDS-2026-0147", title: "Bio Founders Roundtable", company: "ミライ細胞研究会", status: "追加情報待ち / Awaiting info", color: "amber", date: "9月22日" },
  { id: "SDS-2026-0146", title: "宇宙データ活用ワークショップ", company: "Orbital Mesh", status: "新着 / New", color: "mint", date: "10月3日" },
  { id: "SDS-2026-0145", title: "量子×金融 勉強会", company: "クォンタムブリッジ", status: "審査中 / Under review", color: "amber", date: "10月8日" },
  { id: "SDS-2026-0144", title: "地域エネルギー共創会議", company: "東海エナジーラボ", status: "新着 / New", color: "mint", date: "10月15日" },
];

let state = { application: structuredClone(DEMO_APPLICATION), analysis: null, activeCase: DEMO_APPLICATION.id, scenario: false, analyzing: false };

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const initials = (value) => String(value || "S").replace(/株式会社|合同会社/g, "").slice(0, 2);
const statusLabel = (status) => ({
  "企画面談候補": "企画面談候補 / Planning candidate",
  "追加情報待ち": "追加情報待ち / Awaiting info",
  "新着": "新着 / New",
  "審査中": "審査中 / Under review",
}[status] || status);
const candidateLabel = (label) => ({
  "第1希望": "第1希望 / 1st choice",
  "第2希望": "第2希望 / 2nd choice",
  "代替候補": "代替候補 / Alternative",
}[label] || label);
const priorityLabel = (priority) => ({ 高: "高 / High", 中: "中 / Medium", 低: "低 / Low" }[priority] || priority);
const ownerLabel = (owner) => ({ 運営: "運営 / Operations", 企画: "企画 / Planning", コミュニティ: "コミュニティ / Community" }[owner] || owner);
const roleLabel = (role) => ({
  "課題提供・審査員": "課題提供・審査員 / Challenge owner & judge",
  "登壇・デモ": "登壇・デモ / Speaker & demo",
  "個別面談": "個別面談 / 1:1 meeting",
}[role] || role);
const formatDate = (value) => {
  const normalized = String(value || "").replaceAll("/", "-");
  return normalized ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${normalized}T00:00:00`)) : "未定";
};
const toast = (message) => { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2800); };

async function refreshApiKeyStatus() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    const status = $("#apiKeyStatus");
    if (payload.kimiConfigured) {
      status.textContent = "接続済み / Connected";
      status.classList.add("connected");
    }
  } catch {
    // The dashboard can still run in demo mode when the health check is unavailable.
  }
}

async function connectApiKey() {
  const input = $("#apiKeyInput");
  const button = $("#saveApiKey");
  const status = $("#apiKeyStatus");
  const apiKey = input.value.trim();
  if (!apiKey) return toast("APIキーを入力してください / Enter an API key");
  button.classList.add("loading");
  button.textContent = "接続中 / Connecting…";
  try {
    const response = await fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) });
    const payload = await response.json();
    if (!response.ok || !payload.kimiConfigured) throw new Error(payload.error || "API key was not accepted");
    input.value = "";
    status.textContent = "接続済み / Connected";
    status.classList.add("connected");
    toast("KIMI接続を設定しました / KIMI connection configured");
  } catch (error) {
    status.textContent = "接続失敗 / Connection failed";
    status.classList.remove("connected");
    toast(`${error.message} / Connection failed`);
  } finally {
    button.classList.remove("loading");
    button.textContent = "接続 / Connect";
  }
}

function demoAnalysis() {
  const app = state.application || DEMO_APPLICATION;
  const area = String(app.deeptechArea || "").split(" / ")[0];
  const purpose = String(app.purpose || "").split(" / ")[0];
  const attendeeCount = Number(app.attendeeCount || 0);
  const requestedDates = [app.firstDate, app.secondDate].filter(Boolean);
  const date1Blocked = state.scenario || ["2026-09-10", "2026-09-18"].includes(String(app.firstDate || "").replaceAll("/", "-"));
  const checks = [app.eventType, app.purpose, app.attendees, attendeeCount, requestedDates.length, app.food, app.equipment, app.sdsSupport];
  const completion = Math.round((checks.filter((value) => String(value || "").trim()).length / checks.length) * 100);
  const fitSignals = [area, purpose, app.attendees, attendeeCount > 0 && attendeeCount <= 120];
  const fitScore = Math.round((fitSignals.filter(Boolean).length / fitSignals.length) * 100);
  const missingQuestions = [];
  if (!app.setupTime) missingQuestions.push("会場準備・撤去に必要な時間を教えてください。");
  if (!app.sdsSupport) missingQuestions.push("共同開催において、SDSへ希望する支援を選択してください。");
  if (!app.alcohol) missingQuestions.push("飲食提供がある場合、アルコール提供の有無を教えてください。");
  const candidates = requestedDates.map((date, index) => ({
    date,
    label: index === 0 ? "第1希望" : "第2希望",
    available: !(index === 0 && date1Blocked),
    reason: index === 0 && date1Blocked ? "既存予約と重なるため利用困難" : "希望条件内で仮確保候補",
  }));
  if (!candidates.some((candidate) => candidate.available)) candidates.push({ date: "2026-09-24", label: "代替候補", available: true, reason: "同じ曜日・時間帯で代替可能" });
  else if (candidates.length < 3) candidates.push({ date: "2026-09-24", label: "代替候補", available: true, reason: "準備期間を確保しやすい代替日" });
  const availableDates = candidates.filter((candidate) => candidate.available).map((candidate) => candidate.date);
  const hasFood = String(app.food || "").startsWith("飲食提供あり");
  return {
    mode: "demo",
    fitScore: state.scenario ? Math.max(0, fitScore - 8) : fitScore,
    fitLabel: fitScore >= 75 ? "高" : fitScore >= 50 ? "中" : "要確認",
    completion,
    facility: attendeeCount > 120 ? "人数が標準スペース上限を超えるため、会場分割または規模調整が必要" : "人数は標準スペースの想定範囲内",
    fitReasons: [area ? `${area}領域でSDSの対象テーマと一致` : "ディープテック領域の入力が必要", purpose ? `${purpose}を通じた共創の可能性がある` : "開催目的の入力が必要", attendeeCount <= 120 ? "希望人数が施設条件内" : "希望人数が施設条件を超過"],
    missingQuestions,
    candidates,
    memberMatches: [
      { label: "事業会社A", role: "課題提供・審査員", reason: "AI実証先を募集している" },
      { label: "スタートアップB", role: "登壇・デモ", reason: "製品領域とイベントテーマが一致" },
      { label: "投資家C", role: "個別面談", reason: "対象となる事業段階への投資実績がある" },
    ],
    tasks: [
      { label: "希望日の仮確認", owner: "運営", priority: "高", done: false },
      { label: "共同開催可否を内部確認", owner: "企画", priority: app.sdsSupport ? "高" : "中", done: false },
      { label: "申込者との30分面談", owner: "運営", priority: "中", done: false },
      ...(hasFood ? [{ label: "飲食・アルコール条件を案内", owner: "運営", priority: "中", done: false }] : []),
      { label: "会員候補へ匿名概要を提示", owner: "コミュニティ", priority: "中", done: false },
    ],
    recommendedAction: fitScore >= 75 && missingQuestions.length <= 2 ? "共同開催候補として、企画面談へ進める" : "追加情報を依頼",
    recommendedReason: fitScore >= 75 && missingQuestions.length <= 2 ? "SDSの対象領域と一致し、複数会員との連携可能性があります。最終判断は運営担当者が行います。" : "日程・役割・施設条件の確認が残っているため、追加情報を受けてから判断するのが安全です。",
    alternativePlans: [{ title: "別日へ移動", detail: `${availableDates.slice(0, 2).map((date) => formatDate(date)).join("または")}へ移動` }, { title: "開始時刻を変更", detail: "18:30開始へ変更し準備枠を確保" }, { title: "小規模案", detail: "50名以下に抑え別スペースも検討" }],
    replyDraft: `お申込みありがとうございます。\n\nご希望内容を確認し、現時点では${availableDates.map((date) => formatDate(date)).join("または")}が候補となります。${date1Blocked ? `なお、${formatDate(app.firstDate)}は既存予約と重なるため、代替候補をご提案します。` : ""}\n\n${missingQuestions.length ? `検討にあたり、以下をご確認ください。\n・${missingQuestions.join("\n・")}\n\n` : ""}最終的な日程と開催条件は、運営確認後にご案内します。`,
  };
}

function renderCaseList() {
  if ($("#queueCount")) $("#queueCount").textContent = CASES.length;
  if ($("#caseCount")) $("#caseCount").textContent = `${CASES.length}件 / cases`;
  if ($("#unprocessedKpi")) $("#unprocessedKpi").innerHTML = `${CASES.length}<span class="kpi-unit">件 / cases</span>`;
  $("#caseList").innerHTML = CASES.map((item) => `<div class="case-row ${item.id === state.activeCase ? "selected" : ""}" data-case-id="${item.id}"><div class="case-row-top"><div class="case-row-title">${escapeHtml(item.title)}</div><span class="status-pill ${item.color}">${escapeHtml(statusLabel(item.status))}</span></div><div class="case-row-company">${escapeHtml(item.company)} ・ ${item.date}</div></div>`).join("");
  document.querySelectorAll(".case-row").forEach((row) => row.addEventListener("click", () => { const item = CASES.find((candidate) => candidate.id === row.dataset.caseId); if (item?.application) state.application = structuredClone(item.application); state.activeCase = row.dataset.caseId; state.scenario = false; state.analysis = demoAnalysis(); render(); }));
}

function renderAnalysis(a) {
  const questionHtml = a.missingQuestions?.length ? a.missingQuestions.map((question) => `<div class="question-item">${escapeHtml(question)}</div>`).join("") : `<div class="empty-state">現時点で大きな不足はありません。運営確認へ進めます。 / No major gaps found. Ready for operator review.</div>`;
  const dates = a.candidates?.map((candidate) => `<div class="date-item ${candidate.available ? "available" : "blocked"}"><div class="date-icon">${candidate.available ? "✓" : "×"}</div><div class="date-copy"><strong>${escapeHtml(formatDate(candidate.date))} <span class="muted">${escapeHtml(candidateLabel(candidate.label))}</span></strong><small>${escapeHtml(candidate.reason || "")}</small></div><span class="date-badge">${candidate.available ? "候補 / Candidate" : "利用困難 / Unavailable"}</span></div>`).join("") || "";
  const members = a.memberMatches?.map((member) => `<div class="member-item"><div class="member-avatar">${escapeHtml(initials(member.label))}</div><div><strong>${escapeHtml(member.label)}</strong><small>${escapeHtml(member.reason)}</small></div><span class="match-tag">${escapeHtml(roleLabel(member.role))}</span></div>`).join("") || `<div class="empty-state">候補を整理中です。 / Matching candidates are being prepared.</div>`;
  const tasks = a.tasks?.map((task) => `<div class="task-item"><span class="task-check"></span><div><strong>${escapeHtml(task.label)}</strong><small>${escapeHtml(ownerLabel(task.owner))}</small></div><span class="task-meta priority-${task.priority === "高" ? "high" : task.priority === "中" ? "mid" : "low"}">${escapeHtml(priorityLabel(task.priority))}</span></div>`).join("") || "";
  const alternatives = a.alternativePlans?.map((item) => `<div class="alternative"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>`).join("") || "";
  return `<div class="detail-grid"><div class="detail-card"><div class="section-heading"><h3>SDSとの適合性整理 / SDS fit assessment</h3><span class="mode-tag ${a.mode === "kimi" ? "kimi" : ""}">${a.mode === "kimi" ? "KIMI分析 / KIMI analysis" : "Demo分析 / Demo analysis"}</span></div><div class="fit-layout"><div class="fit-score" style="background:conic-gradient(var(--coral) 0 ${Math.round((a.fitScore || 0) * 3.6)}deg,#f0f1f4 ${Math.round((a.fitScore || 0) * 3.6)}deg 360deg)"><strong>${a.fitScore}</strong><small>適合度 / Fit</small></div><div class="fit-copy"><p>${escapeHtml(a.fitSummary || a.recommendedReason)}</p><ul class="bullet-list">${a.fitReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div></div></div><div class="detail-card date-card"><div class="section-heading"><h3>空き候補日 / Candidate dates</h3><span class="section-kicker">FACILITY CHECK</span></div><div class="date-list">${dates}</div><div class="alternative-list">${alternatives}</div></div><div class="detail-card"><div class="section-heading"><h3>推奨する追加質問 / Recommended follow-up</h3><span class="section-kicker">${a.missingQuestions?.length || 0}件 / items</span></div><div class="questions">${questionHtml}</div></div><div class="detail-card"><div class="section-heading"><h3>会員・パートナー候補 / Member & partner candidates</h3><span class="section-kicker">匿名概要 / Anonymous profiles</span></div><div class="member-list">${members}</div></div><div class="detail-card"><div class="section-heading"><h3>運営タスク / Operations tasks</h3><span class="section-kicker">${a.tasks?.length || 0}件 / items</span></div><div class="task-list">${tasks}</div></div><div class="detail-card"><div class="section-heading"><h3>返信案 / Reply draft</h3><button class="link-btn" data-action="copy-reply">コピー / Copy</button></div><div class="reply-box" id="replyDraft">${escapeHtml(a.replyDraft)}</div><div class="reply-footer"><button class="link-btn" data-action="edit-reply">返信案を編集する / Edit reply →</button></div></div></div>`;
}

function render() {
  renderCaseList();
  const a = state.analysis || demoAnalysis();
  $("#completionKpi").innerHTML = `${a.completion}<span class="kpi-unit">%</span>`;
  const app = state.application;
  const activeCase = CASES.find((item) => item.id === state.activeCase) || {};
  $("#caseDetail").innerHTML = `<div class="detail-hero"><div class="detail-hero-main"><div class="detail-title-line"><h2>${escapeHtml(app.title)}</h2><span class="status-pill ${activeCase.color || "coral"}">${escapeHtml(statusLabel(activeCase.status || "企画面談候補"))}</span><span class="mode-tag ${a.mode === "kimi" ? "kimi" : ""}">${a.mode === "kimi" ? "KIMI分析済み / KIMI analyzed" : "デモデータ / Demo data"}</span></div><div class="hero-meta"><span><strong>申込ID / Application ID</strong>${escapeHtml(app.id)}</span><span><strong>申込者 / Applicant</strong>${escapeHtml(app.company)}</span><span><strong>希望日 / Requested dates</strong>${escapeHtml(formatDate(app.firstDate))} / ${escapeHtml(formatDate(app.secondDate))}</span><span><strong>規模 / Scale</strong>${escapeHtml(app.attendeeCount)}名 / people</span></div><div class="progress-block"><div class="progress-label"><span>情報充足率 / Completeness</span><strong>${a.completion}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${a.completion}%"></div></div></div></div><div class="hero-actions"><button class="secondary-btn" data-action="ask-more">追加情報を依頼 / Request info</button><button class="primary-btn" data-action="advance">企画面談へ進める / Advance to planning</button></div></div>${renderAnalysis(a)}`;
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
}

function handleAction(action) {
  if (action === "copy-reply") navigator.clipboard?.writeText($("#replyDraft")?.textContent || "").then(() => toast("返信案をコピーしました / Reply draft copied"));
  if (action === "edit-reply") toast("返信案の編集モードは次の拡張で追加できます / Reply editing is planned for the next extension");
  if (action === "ask-more") toast("追加情報依頼タスクを作成しました / Follow-up task created");
  if (action === "advance") toast("企画面談へ進める判断を記録しました / Planning-meeting decision recorded");
}

async function runAnalysis() {
  state.analyzing = true; $("#analyzeButton").classList.add("loading"); $("#analyzeButton").innerHTML = "✦ 分析中 / Analyzing…";
  try {
    const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state.application) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "分析に失敗しました");
    state.analysis = payload; render(); toast(payload.mode === "kimi" ? "KIMI 2.7の分析結果を反映しました / KIMI analysis applied" : "デモ分析結果を反映しました（APIキー未設定） / Demo analysis applied (API key not configured)");
  } catch (error) { toast(`${error.message} / Analysis failed`); } finally { state.analyzing = false; $("#analyzeButton").classList.remove("loading"); $("#analyzeButton").innerHTML = '<span class="sparkle">✦</span> KIMIで再分析 / Re-run with KIMI'; }
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; const next = text[i + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += char; }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift() || []; return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function mapCsvRow(row, index = 0) {
  const normalizeKey = (value) => String(value || "").replace(/^\uFEFF/, "").toLowerCase().replace(/[\s/]/g, "");
  const entries = Object.entries(row);
  const get = (number, ...names) => {
    const numbered = entries.find(([key]) => String(key).replace(/^\uFEFF/, "").startsWith(`${number}.`));
    if (numbered?.[1]) return numbered[1];
    const candidates = names.map(normalizeKey);
    return entries.find(([key, value]) => value && candidates.some((candidate) => normalizeKey(key).includes(candidate)))?.[1] || "";
  };
  const date = (value) => String(value || "").replaceAll("/", "-");
  return {
    ...DEMO_APPLICATION,
    id: `SDS-CSV-${String(index + 1).padStart(3, "0")}`,
    company: get(1, "企業・団体名", "Company name", "company") || DEMO_APPLICATION.company,
    department: get(2, "ご担当者 所属", "Department name", "department") || DEMO_APPLICATION.department,
    contactName: get(3, "ご担当者 氏名", "Name of contact person", "contactName") || DEMO_APPLICATION.contactName,
    contactKana: get(4, "名前（よみがな）", "kana", "contactKana") || DEMO_APPLICATION.contactKana,
    phone: get(5, "電話番号", "Telephone number", "phone") || DEMO_APPLICATION.phone,
    email: get(6, "メールアドレス", "E-mail address", "email") || DEMO_APPLICATION.email,
    organizer: get(7, "主催者名", "Organizer Name", "organizer") || DEMO_APPLICATION.organizer,
    coOrganizer: get(8, "共催者名", "co-organizer", "coOrganizer") || DEMO_APPLICATION.coOrganizer,
    purpose: get(9, "開催目的", "Purpose of the event", "purpose") || DEMO_APPLICATION.purpose,
    deeptechArea: get(10, "ディープテック分野", "Deeptech areas", "deeptechArea") || DEMO_APPLICATION.deeptechArea,
    eventType: get(11, "開催方式", "Event type", "eventType") || DEMO_APPLICATION.eventType,
    participation: get(12, "イベント参加方法", "How to Participate", "participation") || DEMO_APPLICATION.participation,
    title: get(13, "イベントタイトル", "Event title", "title") || DEMO_APPLICATION.title,
    firstDate: date(get(14, "第１希望", "第1希望日", "firstDate") || DEMO_APPLICATION.firstDate),
    secondDate: date(get(15, "第２希望", "第2希望日", "secondDate") || DEMO_APPLICATION.secondDate),
    startTime: get(16, "開始予定時刻", "Estimated event start time", "startTime") || DEMO_APPLICATION.startTime,
    endTime: get(17, "終了予定時刻", "Estimated end time", "endTime") || DEMO_APPLICATION.endTime,
    attendeeCount: Number(get(18, "規模（人数）", "規模人数", "Scale", "attendeeCount")) || DEMO_APPLICATION.attendeeCount,
    fee: get(19, "参加費", "Participation Fee", "fee") || DEMO_APPLICATION.fee,
    language: get(20, "使用される言語", "Languages used", "language") || DEMO_APPLICATION.language,
    interpretation: get(21, "通訳", "Interpretation", "interpretation") || DEMO_APPLICATION.interpretation,
    attendees: get(22, "参加対象者", "Kinds of attendees", "attendees") || DEMO_APPLICATION.attendees,
    details: get(23, "開催内容詳細", "Event details", "details") || DEMO_APPLICATION.details,
    equipment: get(24, "機材", "Whether or not there is anything to bring in", "equipment") || DEMO_APPLICATION.equipment,
    food: get(25, "飲食提供", "Food and Beverage", "food") || DEMO_APPLICATION.food,
    discovery: get(26, "知ったきっかけ", "What led you to learn", "discovery") || DEMO_APPLICATION.discovery,
    setupTime: "",
    alcohol: "",
    sdsSupport: "",
  };
}

function buildCsvCases(rows) {
  const statuses = [
    ["企画面談候補 / Planning candidate", "coral"],
    ["追加情報待ち / Awaiting info", "amber"],
    ["新着 / New", "mint"],
    ["審査中 / Under review", "amber"],
  ];
  return rows.map((row, index) => {
    const application = mapCsvRow(row, index);
    const [status, color] = index === 0 ? statuses[0] : statuses[(index % (statuses.length - 1)) + 1];
    return { id: application.id, title: application.title, company: application.company, status, color, date: formatDate(application.firstDate), application };
  });
}

async function loadBundledDemoData() {
  try {
    const response = await fetch("/data/sds_event_request_sample_50.csv");
    if (!response.ok) return;
    const rows = parseCsv(await response.text());
    if (!rows.length) return;
    CASES = buildCsvCases(rows);
    state.application = structuredClone(CASES[0].application);
    state.activeCase = CASES[0].id;
    state.scenario = false;
    state.analysis = demoAnalysis();
    render();
    toast(`デモCSVから${rows.length}件の申込案件を読み込みました / Loaded ${rows.length} demo applications`);
  } catch (error) {
    console.warn("Bundled demo CSV could not be loaded", error);
  }
}

$("#analyzeButton").addEventListener("click", runAnalysis);
$("#saveApiKey").addEventListener("click", connectApiKey);
$("#scenarioButton").addEventListener("click", () => { state.scenario = !state.scenario; toast(state.scenario ? "第1希望日を利用困難に変更しました / First requested date is now unavailable" : "通常の希望条件に戻しました / Restored normal conditions"); state.analysis = demoAnalysis(); render(); });
$("#resetButton").addEventListener("click", () => { state.application = structuredClone(DEMO_APPLICATION); state.scenario = false; state.analysis = demoAnalysis(); render(); toast("デモ案件をリセットしました / Demo case reset"); });
$("#importCsv").addEventListener("click", () => $("#csvInput").click());
$("#csvInput").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; const rows = parseCsv(await file.text()); if (!rows.length) return toast("CSVにデータ行がありません / No data rows found in CSV"); CASES = buildCsvCases(rows); state.application = structuredClone(CASES[0].application); state.activeCase = CASES[0].id; state.scenario = false; state.analysis = demoAnalysis(); render(); toast(`${rows.length}件の申込案件を読み込みました / Loaded ${rows.length} applications`); });
state.analysis = demoAnalysis(); render();
loadBundledDemoData();
refreshApiKeyStatus();
