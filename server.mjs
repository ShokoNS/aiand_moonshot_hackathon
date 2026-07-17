import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
let runtimeApiKey = "";
let systemCaPromise;

async function loadSystemCa() {
  if (!systemCaPromise) {
    systemCaPromise = (async () => {
      const candidates = [
        process.env.NODE_EXTRA_CA_CERTS,
        "/etc/ssl/cert.pem",
        "/etc/ssl/certs/ca-certificates.crt",
      ].filter(Boolean);
      for (const candidate of candidates) {
        try {
          return await fs.readFile(candidate);
        } catch {
          // Try the next platform-specific certificate bundle.
        }
      }
      return undefined;
    })();
  }
  return systemCaPromise;
}

async function postJson(url, body, headers) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const ca = target.protocol === "https:" ? await loadSystemCa() : undefined;

  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method: "POST",
      headers,
      ...(ca ? { ca } : {}),
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function loadDotEnv() {
  try {
    const contents = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // .env is optional; demo mode works without it.
  }
}

const MEMBERS = [
  { id: "member-a", label: "事業会社A", role: "課題提供・審査員", area: "AIと機械学習", reason: "AI実証先を募集している" },
  { id: "member-b", label: "スタートアップB", role: "登壇・デモ", area: "AIと機械学習 / ロボティクス", reason: "製品領域とイベントテーマが一致" },
  { id: "member-c", label: "投資家C", role: "個別面談", area: "スタートアップ支援", reason: "対象となる事業段階への投資実績がある" },
  { id: "member-d", label: "研究機関D", role: "技術コメント", area: "ロボティクス / 医療技術", reason: "研究テーマと参加者層が近い" },
];

const BLOCKED_DATES = new Set(["2026-09-10", "2026-09-18"]);

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function parseTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function startsWithOption(value, label) {
  return String(value || "").trim().startsWith(label);
}

function japaneseLabel(value) {
  return String(value || "").split(" / ")[0].trim();
}

function completionFor(application) {
  const checks = [
    ["イベント形式", application.eventType],
    ["開催目的", application.purpose],
    ["参加対象", application.attendees],
    ["参加人数", application.attendeeCount],
    ["希望日", application.firstDate || application.secondDate],
    ["飲食条件", application.food],
    ["必要設備", application.equipment],
    ["SDSへの期待役割", application.sdsSupport],
  ];
  const complete = checks.filter(([, value]) => String(value || "").trim()).length;
  return Math.round((complete / checks.length) * 100);
}

function candidateDates(application) {
  const requested = [application.firstDate, application.secondDate].filter(Boolean);
  const candidates = requested.map((date, index) => ({
    date,
    label: index === 0 ? "第1希望" : "第2希望",
    available: !BLOCKED_DATES.has(date),
    reason: BLOCKED_DATES.has(date) ? "既存予約と重なるため利用困難" : "希望条件内で仮確保候補",
  }));
  const fallback = requested.find((date) => !BLOCKED_DATES.has(date));
  if (!candidates.some((item) => item.available)) {
    candidates.push({ date: "2026-09-24", label: "代替候補", available: true, reason: "同じ曜日・時間帯で代替可能" });
  } else if (fallback && candidates.length < 3) {
    candidates.push({ date: "2026-09-24", label: "代替候補", available: true, reason: "準備期間を確保しやすい代替日" });
  }
  return candidates;
}

function createDeterministicAnalysis(application) {
  const area = japaneseLabel(application.deeptechArea);
  const purpose = japaneseLabel(application.purpose);
  const hasFood = startsWithOption(application.food, "飲食提供あり");
  const fitSignals = [
    area ? 1 : 0,
    purpose ? 1 : 0,
    application.attendees ? 1 : 0,
    application.sdsSupport ? 1 : 0,
    Number(application.attendeeCount || 0) <= 120 ? 1 : 0,
  ];
  const fitScore = Math.round((fitSignals.reduce((sum, value) => sum + value, 0) / fitSignals.length) * 100);
  const missingQuestions = [];
  if (!application.setupTime) missingQuestions.push("会場準備・撤去に必要な時間を教えてください。");
  if (!application.sdsSupport) missingQuestions.push("共同開催において、SDSへ希望する支援を選択してください。");
  if (!application.alcohol) missingQuestions.push("飲食提供がある場合、アルコール提供の有無を教えてください。");
  const missingQuestionsEn = [];
  if (!application.setupTime) missingQuestionsEn.push("Please tell us the time required for setup and teardown.");
  if (!application.sdsSupport) missingQuestionsEn.push("Please select the support you would like SDS to provide for the co-hosted event.");
  if (!application.alcohol) missingQuestionsEn.push("If food or beverages will be served, please confirm whether alcohol will be provided.");
  const candidates = candidateDates(application);
  const capacity = Number(application.attendeeCount || 0);
  const facility = capacity > 120 ? "人数が標準スペース上限を超えるため、会場分割または規模調整が必要" : "人数は標準スペースの想定範囲内";
  const memberMatches = MEMBERS.filter((member) => !area || member.area.includes(area) || member.id === "member-c").slice(0, 3);
  const tasks = [
    { label: "希望日の仮確認", owner: "運営", priority: "高", done: false },
    { label: "共同開催可否を内部確認", owner: "企画", priority: application.sdsSupport ? "高" : "中", done: false },
    { label: "申込者との30分面談", owner: "運営", priority: "中", done: false },
    ...(hasFood ? [{ label: "飲食・アルコール条件を案内", owner: "運営", priority: "中", done: false }] : []),
    { label: "会員候補へ匿名概要を提示", owner: "コミュニティ", priority: "中", done: false },
    { label: "告知範囲と登壇者情報を確定", owner: "企画", priority: "低", done: false },
  ];
  const action = fitScore >= 75 && missingQuestions.length <= 2 ? "企画面談へ進める" : "追加情報を依頼";
  return {
    mode: "demo",
    fitScore,
    fitLabel: fitScore >= 75 ? "高" : fitScore >= 50 ? "中" : "要確認",
    completion: completionFor(application),
    facility,
    fitReasons: [
      area ? `${area}領域でSDSの対象テーマと一致` : "ディープテック領域の入力が必要",
      purpose ? `${purpose}を通じた共創の可能性がある` : "開催目的の入力が必要",
      capacity <= 120 ? "希望人数が施設条件内" : "希望人数が施設条件を超過",
    ],
    missingQuestions,
    candidates,
    memberMatches,
    tasks,
    recommendedAction: action,
    recommendedReason: action === "企画面談へ進める" ? "対象領域・参加者・規模がSDSの共創案件として整理しやすく、複数会員との連携可能性があります。" : "日程・役割・施設条件の確認が残っているため、追加情報を受けてから判断するのが安全です。",
    alternativePlans: [
      { title: "別日へ移動", detail: "第2希望または9月24日に移動し、準備時間を確保する" },
      { title: "開始時刻を変更", detail: "18:30開始へ変更し、準備枠を確保する" },
      { title: "小規模案", detail: "50名以下に抑え、別スペースも検討する" },
    ],
    replyDraft: `お申込みありがとうございます。\n\nご希望内容を確認し、現時点では${candidates.filter((item) => item.available).map((item) => item.date).join("、")}が候補となります。\n\n${missingQuestions.length ? `検討にあたり、以下をご確認ください。\n・${missingQuestions.join("\n・")}\n\n` : ""}最終的な日程と開催条件は、運営確認後にご案内します。`,
    replyDraftEn: `Thank you for your application.\n\nBased on the details received, ${candidates.filter((item) => item.available).map((item) => item.date).join(" or ")} are currently available candidate dates.\n\n${missingQuestionsEn.length ? `To proceed, please confirm the following:\n- ${missingQuestionsEn.join("\n- ")}\n\n` : ""}We will follow up with the final date and event conditions after our internal review.`,
  };
}

function buildKimiPrompt(application, base) {
  return `あなたはSDS運営の補助エージェントです。採否、予約確定、会員への直接連絡は決めず、運営担当者が確認できる判断材料だけを整理してください。以下の申込みを分析し、必ずJSONオブジェクトだけを返してください。判断材料と各項目は日本語で、返信案は日本語版と英語版の両方を作成してください。\n\n申込データ:\n${JSON.stringify(application, null, 2)}\n\n通常処理で検出済みの事実:\n${JSON.stringify({ completion: base.completion, candidates: base.candidates, facility: base.facility, memberMatches: base.memberMatches }, null, 2)}\n\nJSONのキーは fitSummary(string), additionalQuestions(string[]), alternativePlans(array of {title,detail}), memberMatches(array of {label,role,reason}), tasks(array of {label,owner,priority}), recommendedAction(string), recommendedReason(string), replyDraft(string), replyDraftEn(string)。replyDraftEnは申込者へそのまま送れる自然な英語にしてください。会員の氏名や連絡先など非公開情報は出さず、候補は匿名ラベルだけにしてください。`;
}

function extractJson(text) {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("KIMI response was not JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function mergeKimi(base, kimi) {
  return {
    ...base,
    mode: "kimi",
    fitSummary: kimi.fitSummary || base.recommendedReason,
    missingQuestions: Array.isArray(kimi.additionalQuestions) && kimi.additionalQuestions.length ? kimi.additionalQuestions : base.missingQuestions,
    alternativePlans: Array.isArray(kimi.alternativePlans) && kimi.alternativePlans.length ? kimi.alternativePlans : base.alternativePlans,
    memberMatches: Array.isArray(kimi.memberMatches) && kimi.memberMatches.length ? kimi.memberMatches : base.memberMatches,
    tasks: Array.isArray(kimi.tasks) && kimi.tasks.length ? kimi.tasks : base.tasks,
    recommendedAction: kimi.recommendedAction || base.recommendedAction,
    recommendedReason: kimi.recommendedReason || base.recommendedReason,
    replyDraft: kimi.replyDraft || base.replyDraft,
    replyDraftEn: kimi.replyDraftEn || base.replyDraftEn,
  };
}

async function analyze(application) {
  const base = createDeterministicAnalysis(application);
  const apiKey = runtimeApiKey || process.env.AIAND_API_KEY;
  if (!apiKey || apiKey === "your_aiand_api_key_here") return base;
  const baseUrl = (process.env.AIAND_BASE_URL || "https://api.aiand.com/v1").replace(/\/$/, "");
  const model = process.env.AIAND_MODEL || "moonshotai/kimi-k2.7-code";
  const requestBody = JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: "You are a careful operations analyst. Return valid JSON only." },
      { role: "user", content: buildKimiPrompt(application, base) },
    ],
  });
  const response = await postJson(`${baseUrl}/chat/completions`, requestBody, {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "content-length": Buffer.byteLength(requestBody),
  });
  if (response.status < 200 || response.status >= 300) {
    let detail = "";
    try {
      const errorPayload = JSON.parse(response.body);
      detail = errorPayload?.error?.message || errorPayload?.message || "";
    } catch {
      // Keep the public error concise when the upstream response is not JSON.
    }
    throw new Error(`KIMI API error: ${response.status}${detail ? ` (${String(detail).slice(0, 240)})` : ""}`);
  }
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error("KIMI response was not valid JSON");
  }
  const content = payload?.choices?.[0]?.message?.content;
  return mergeKimi(base, extractJson(content));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".csv": "text/csv; charset=utf-8" };

function hasConfiguredApiKey() {
  const key = runtimeApiKey || process.env.AIAND_API_KEY || "";
  return Boolean(key && key !== "your_aiand_api_key_here");
}

async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = path.normalize(requested === "/" ? "/index.html" : requested);
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: "Forbidden" });
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

await loadDotEnv();
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true, kimiConfigured: hasConfiguredApiKey(), model: process.env.AIAND_MODEL || "moonshotai/kimi-k2.7-code" });
    if (req.method === "POST" && req.url === "/api/config") {
      const config = JSON.parse(await readBody(req));
      const apiKey = String(config.apiKey || "").trim();
      if (apiKey.length > 500) throw new Error("API key is too long");
      runtimeApiKey = apiKey;
      return json(res, 200, { ok: true, kimiConfigured: hasConfiguredApiKey() });
    }
    if (req.method === "POST" && req.url === "/api/analyze") {
      const application = JSON.parse(await readBody(req));
      const result = await analyze(application);
      return json(res, 200, result);
    }
    if (req.method === "GET") return serveStatic(req, res);
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || "Unexpected error" });
  }
});

server.listen(PORT, () => console.log(`SDS Event Producer Agent running at http://localhost:${PORT}`));
