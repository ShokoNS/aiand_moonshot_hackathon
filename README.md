# SDS Event Producer Agent

SDS Event Producer Agent is a web MVP for turning event applications into structured, reviewable operations cases. It is designed for SDS staff who need to decide what to confirm next, which dates may work, whether an event fits SDS, which anonymous member profiles may be relevant, and what reply or internal tasks should be prepared.

The product is intentionally operations-first. It does not treat the applicant-facing form as the main product. The form is an intake layer; the main value is reducing the time required to turn an incoming application into a decision-ready case.

## Screenshots

The screenshots below were captured from the local demo using the bundled 50-row sample dataset.

![SDS Event Producer Agent dashboard overview](public/assets/dashboard-overview.jpg)

![SDS Event Producer Agent analysis detail](public/assets/analysis-detail.jpg)

## What problem this solves

After an event application arrives, an SDS operations team typically has to:

1. Read the application and identify missing information.
2. Decide whether the event is relevant to SDS and its community.
3. Compare requested dates, hours, capacity, and facility conditions.
4. Decide whether the case is a normal rental, a co-hosting opportunity, or a case requiring a planning conversation.
5. Search for relevant member or partner profiles.
6. Ask the applicant follow-up questions.
7. Create internal tasks and draft a reply.

The expensive part is not receiving the form response. The expensive part is transforming an inconsistent response into an operational case that another person can safely review.

This MVP automates the preparation of that case while keeping final approval with the SDS operator.

## Product principles

- AI prepares evidence and wording; an SDS operator makes the final decision.
- Calendar, capacity, required-field, and state checks remain deterministic program logic.
- Member matching uses anonymous labels in the demo. The system does not expose member contact details to applicants.
- KIMI is not allowed to approve an event, confirm a reservation, or contact a member directly.
- Missing information is converted into specific follow-up questions instead of a generic “incomplete” flag.
- A date conflict should produce alternatives, not only a failure state.

## Main workflow

```text
Applicant response
        |
        v
Structured event application
        |
        v
SDS Event Producer Agent
  |-- completeness check
  |-- SDS fit summary
  |-- deterministic facility/date check
  |-- anonymous member/partner suggestions
  |-- operational task generation
  `-- applicant reply draft
        |
        v
SDS operator review and approval
```

## Current MVP capabilities

### Operations dashboard

- Displays an application queue with all 50 bundled demo cases.
- Shows the selected event, applicant company, application ID, requested dates, and scale.
- Shows completion rate, fit score, missing questions, candidate dates, member/partner suggestions, tasks, and a reply draft.
- Includes operator actions to request more information, advance to a planning meeting, and copy the reply draft.
- Primary navigation, KPI labels, actions, statuses, and analysis section headings are displayed in Japanese and English side by side.

### Demo dataset

- Loads `public/data/sds_event_request_sample_50.csv` automatically on startup.
- Supports the 26-column SDS application format supplied for this demo.
- Converts every CSV row into a selectable case.
- Also supports replacing the queue with another CSV through the “CSVを取り込む” control.

### Scenario change

The “条件変更を試す” action simulates the first requested date becoming unavailable. The interface then shows the blocked date, an available second date or fallback date, and alternative plans such as changing the start time or reducing the scale.

### KIMI 2.7 analysis

When an `AIAND_API_KEY` is configured, “KIMIで再分析” sends the application and deterministic facts to the ai& OpenAI-compatible API. KIMI returns structured Japanese content for:

- fit summary and reasons,
- additional questions,
- alternative plans,
- anonymous member roles,
- operational tasks,
- recommended next action, and
- a reply draft.

Without an API key, the same UI remains usable with deterministic demo analysis. This makes the demo reproducible and prevents the application from failing during a presentation when credentials are unavailable.

## AI and deterministic-program responsibilities

| KIMI 2.7 | Regular application code |
| --- | --- |
| Interpret free-text event details | Parse and validate incoming request data |
| Explain why the event may fit SDS | Calculate completion rate |
| Describe semantic relevance to anonymous member profiles | Check requested dates against blocked demo dates |
| Suggest a role for a potential member or partner | Check scale against the demo capacity threshold |
| Write alternative-plan explanations | Maintain case selection, scenario state, and UI history |
| Draft follow-up questions and an applicant reply | Serve static files and proxy the server-side API request |

The split is deliberate. A language model is useful for interpretation and communication, but it should not be the source of truth for reservation state or operational constraints.

## Architecture

```text
Browser
  public/index.html
  public/styles.css
  public/app.js
       |
       | POST /api/analyze
       v
Node.js HTTP server
  server.mjs
       |
       | deterministic analysis
       | optional server-side API call
       v
ai& inference API
  https://api.aiand.com/v1/chat/completions
  model: moonshotai/kimi-k2.7-code
```

The browser never receives `AIAND_API_KEY`. The server reads the key from `.env` and attaches it only to the outbound API request.

## Prerequisites

- Node.js 18 or newer. Node.js 20 or newer is recommended.
- npm.
- An ai& inference API key only if live KIMI analysis is required.
- Git is required for contributing or pushing changes.

## Quick start

From the repository root:

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The application starts in demo mode without credentials. The bundled CSV is loaded automatically, and the first of the 50 applications is displayed.

For development with automatic server restart:

```bash
npm run dev
```

## Enable live KIMI analysis

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set the API key you created in the ai& console:

   ```dotenv
   PORT=3000
   AIAND_BASE_URL=https://api.aiand.com/v1
   AIAND_API_KEY=replace_with_your_aiand_api_key
   AIAND_MODEL=moonshotai/kimi-k2.7-code
   ```

3. Restart the server:

   ```bash
   npm start
   ```

4. Open the dashboard and click “KIMIで再分析”.

The API key must remain in `.env` or another server-side secret store. Do not paste it into `public/app.js`, commit it to Git, or place it in a browser URL. `.env` is ignored by Git; `.env.example` contains only a placeholder.

### KIMI request behavior

The server sends a request equivalent to:

```http
POST https://api.aiand.com/v1/chat/completions
Authorization: Bearer <server-side API key>
Content-Type: application/json
```

The configured model is:

```text
moonshotai/kimi-k2.7-code
```

The prompt explicitly instructs KIMI to return one JSON object and not to make approval, reservation, or direct-contact decisions. If the API returns an error, the server returns an error to the UI; no external action is taken.

## Demo operation guide

### 1. Review the queue

The left-side queue shows the 50 demo cases. Each row includes an event title, company, requested first date, and a demo status such as “新着”, “審査中”, or “追加情報待ち”.

### 2. Select an application

Click any row. The detail area updates to the selected CSV row. The application ID is generated as `SDS-CSV-001` through `SDS-CSV-050` for the bundled dataset.

### 3. Inspect the structured analysis

Review these blocks from top to bottom:

1. Application metadata and information completion rate.
2. SDS fit explanation and fit score.
3. Candidate dates and facility notes.
4. Recommended follow-up questions.
5. Anonymous member/partner candidates and proposed roles.
6. Operational tasks.
7. Reply draft.

### 4. Demonstrate replanning

Click “条件変更を試す”. The first requested date is treated as blocked. The result shows a blocked date and alternative plans. This demonstrates that the agent can re-plan when an operational condition changes.

Click “デモをリセット” to return to the first bundled case and the normal scenario.

### 5. Demonstrate KIMI

Configure the API key, select an application, and click “KIMIで再分析”. The analysis cards will show a “KIMI分析” label when the server successfully merges the KIMI response.

## CSV format

The bundled file is a UTF-8 CSV with 50 data rows and 26 columns. It follows the SDS form order:

| No. | Field | Application property |
| ---: | --- | --- |
| 1 | Company name | `company` |
| 2 | Department name | `department` |
| 3 | Contact person name | `contactName` |
| 4 | Contact name reading | `contactKana` |
| 5 | Telephone number | `phone` |
| 6 | Email address | `email` |
| 7 | Organizer name | `organizer` |
| 8 | Co-organizer, sponsor, or collaborator | `coOrganizer` |
| 9 | Event purpose | `purpose` |
| 10 | Deep-tech area | `deeptechArea` |
| 11 | Event type | `eventType` |
| 12 | Participation method | `participation` |
| 13 | Event title | `title` |
| 14 | First desired date | `firstDate` |
| 15 | Second desired date | `secondDate` |
| 16 | Estimated start time | `startTime` |
| 17 | Estimated end time | `endTime` |
| 18 | Scale / attendee count | `attendeeCount` |
| 19 | Participation fee | `fee` |
| 20 | Event language | `language` |
| 21 | Interpretation | `interpretation` |
| 22 | Attendee types | `attendees` |
| 23 | Event details | `details` |
| 24 | Equipment bring-in | `equipment` |
| 25 | Food and beverage | `food` |
| 26 | How the applicant learned about SDS | `discovery` |

The current form CSV does not contain preparation time, alcohol availability, or SDS support expectations. The agent therefore surfaces those items as follow-up questions. These extra fields are represented internally as `setupTime`, `alcohol`, and `sdsSupport` and can be added to a future CSV version.

### Replacing the demo CSV

There are two ways to use another dataset:

1. Replace `public/data/sds_event_request_sample_50.csv` and restart the server. The application loads that file on startup.
2. Use the “CSVを取り込む” control in the sidebar. The selected file is parsed in the browser and all rows replace the current queue for the active session.

The importer expects a header row and uses the numbered form columns when available. It also accepts several English and Japanese header aliases.

## HTTP API

### `GET /api/health`

Returns server and KIMI configuration status without exposing the API key:

```json
{
  "ok": true,
  "kimiConfigured": false,
  "model": "moonshotai/kimi-k2.7-code"
}
```

### `POST /api/analyze`

Accepts one normalized application object and returns the deterministic analysis, optionally merged with KIMI output.

Example request:

```json
{
  "id": "SDS-CSV-001",
  "company": "株式会社ミライAI",
  "title": "DeepTech Meetup 2026: 生成AIの社会実装",
  "firstDate": "2026-09-04",
  "secondDate": "2026-09-11",
  "attendeeCount": 30,
  "deeptechArea": "AIと機械学習 / AI and Machine Learning",
  "purpose": "講演会・セミナー / Lecture ・ Seminar",
  "food": "飲食提供あり / Provide food and beverages to participants"
}
```

The response includes `mode: "demo"` when no API key is configured and `mode: "kimi"` when a valid KIMI response is merged.

## Safety and privacy boundaries

This is a demo and should not be treated as a production reservation system. In particular:

- The application does not send a reservation confirmation.
- The application does not contact applicants or members automatically.
- The application does not publish member personal information.
- The UI uses anonymous demo member labels such as “事業会社A”.
- The server does not expose the KIMI API key to the browser.
- Final approval, reservation confirmation, and external communication remain human actions.
- Do not place real personal data in the repository or in screenshots.

The supplied CSV uses demo contact values such as `example.com` addresses. Replace them with synthetic data before creating additional public demo assets.

## Validation performed

The current implementation has been checked with:

```bash
node --check public/app.js
node --check server.mjs
git diff --check
curl http://localhost:3000/api/health
```

The local browser check also verified:

- 50 case rows are rendered after startup.
- The first case is loaded from the bundled CSV.
- The 50th case can be selected.
- The blocked-date scenario displays “利用困難” and “代替候補”.
- No browser console errors are produced during these flows.

## Limitations and next steps

This MVP intentionally uses small demo rules so the end-to-end product story is easy to inspect. Production work would add:

- a real facility calendar and operating-hours integration,
- capacity and equipment rules sourced from SDS policy,
- authenticated operator accounts and role-based access,
- audit history for analysis, edits, and decisions,
- persistent cases and task ownership,
- a real member directory with permission-aware search,
- an anonymized member-introduction workflow requiring operator approval,
- applicant-facing conditional questions,
- retry, timeout, and schema validation around the KIMI call,
- structured evaluation against real historical applications, and
- deployment configuration with a managed secret store.

## Repository structure

```text
.
├── .env.example
├── .gitignore
├── package.json
├── server.mjs
├── README.md
└── public
    ├── app.js
    ├── data
    │   └── sds_event_request_sample_50.csv
    ├── index.html
    ├── styles.css
    └── assets
        ├── dashboard-overview.jpg
        └── analysis-detail.jpg
```

## License and demo status

This repository is a hackathon/demo MVP for the SDS Event Producer Agent concept. Add a project-specific license before distributing it as a production package.

---

# 日本語

## SDS Event Producer Agentとは

SDS Event Producer Agentは、イベント申込みを、SDS運営担当者が確認・判断・返信・次の作業へ進めやすい構造化案件に整理するWeb MVPです。

申込者向けフォームを主役にするのではなく、フォームを「不足の少ないデータを集める入口」と位置づけています。主な価値は、申込みを受けた後に発生する情報確認、施設条件の照合、日程調整、SDSとの適合性整理、会員候補の発見、追加質問、返信案作成を一つの案件画面にまとめることです。

## スクリーンショット

同梱している50件のデモCSVを読み込んだローカル画面を撮影しています。

![SDS Event Producer Agent ダッシュボード](public/assets/dashboard-overview.jpg)

![SDS Event Producer Agent 分析詳細](public/assets/analysis-detail.jpg)

## 解決する運営課題

イベント申込みが届いた後、運営側では通常、次のような確認が必要になります。

1. 申込内容を読む。
2. 不足情報を確認する。
3. SDSで開催する意味やテーマ適合性を整理する。
4. 希望日、時間、人数、設備、飲食条件を確認する。
5. 通常貸出か、共同開催候補か、企画面談が必要かを考える。
6. イベント目的に合う会員・パートナー候補を探す。
7. 申込者への追加質問、社内タスク、返信案を作る。

負荷が大きいのは、申込みの受信そのものではなく、申込書を「判断できる状態」に整理する作業です。このMVPはその準備作業を支援し、最終的な承認や外部連絡はSDS運営担当者に残します。

## 設計方針

- AIは判断材料と文章を準備し、最終判断はSDS運営が行います。
- 必須項目、人数、時間、日程、施設条件、状態管理は通常プログラムで処理します。
- 会員候補はデモでは匿名ラベルで表示し、個人の連絡先や非公開情報を申込者へ公開しません。
- KIMIに採否、予約確定、会員への直接連絡をさせません。
- 「情報不足」だけで終わらず、追加で何を聞くべきかを具体的な質問にします。
- 希望日が使えない場合は、失敗として止めず、別日・開始時刻変更・小規模案などを出します。

## 現在できること

### 運営ダッシュボード

- 同梱された50件のデモ案件を左側のキューに表示します。
- 案件タイトル、企業名、申込ID、希望日、人数を確認できます。
- 情報充足率、SDS適合性、候補日、追加質問、会員候補、タスク、返信案を表示します。
- 「追加情報を依頼」「企画面談へ進める」「返信案をコピー」の操作を用意しています。
- 主要ナビ、KPI、操作ボタン、ステータス、分析セクションの見出しは、日本語と英語を併記しています。

### デモCSV

- `public/data/sds_event_request_sample_50.csv` を起動時に自動読込します。
- SDSフォームの26項目、50行のサンプルデータに対応しています。
- CSVの各行を1件の選択可能な案件へ変換します。
- サイドバーの「CSVを取り込む」から、別の同形式CSVへその場で差し替えられます。

### 条件変更シナリオ

「条件変更を試す」を押すと、第1希望日が利用できない状態をデモできます。画面には、利用困難な日、利用可能な第2希望または代替日、開始時刻変更案、小規模案が表示されます。

「デモをリセット」を押すと、最初の案件と通常状態へ戻ります。

### KIMI 2.7連携

`AIAND_API_KEY`を設定した状態で「KIMIで再分析」を押すと、サーバーがai&のOpenAI互換APIへ申込データと通常処理の事実を送ります。KIMIは次の内容を日本語の構造化データとして返します。

- SDSとの適合理由
- 推奨する追加質問
- 代替開催案
- 匿名会員候補と役割
- 運営タスク
- 推奨する次の対応
- 申込者への返信案

APIキーがない場合はデモ分析モードで動作します。これにより、ハッカソンのデモ中に認証情報がなくても画面と通常処理を確認できます。

## KIMIと通常プログラムの分担

| KIMI 2.7 | 通常プログラム |
| --- | --- |
| 自由記述の解釈 | 入力値の解析と必須項目確認 |
| SDSとの適合理由の文章化 | 情報充足率の計算 |
| 会員プロフィールとの意味的な一致整理 | デモの空き日・利用困難日の判定 |
| 会員・パートナーの役割提案 | 人数と施設上限の判定 |
| 代替案の文章化 | 案件選択、シナリオ状態、画面状態の管理 |
| 返信案・追加質問・タスクの生成 | 静的ファイル配信とAPIキーを使ったサーバー側通信 |

## 起動方法

必要環境はNode.js 18以上、推奨はNode.js 20以上です。

```bash
npm install
npm start
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。APIキーなしでもデモデータ50件が読み込まれます。

開発中にサーバーを自動再起動する場合は、次を使います。

```bash
npm run dev
```

## KIMIを有効にする方法

1. 環境変数ファイルを作成します。

   ```bash
   cp .env.example .env
   ```

2. `.env`にai&コンソールで作成したAPIキーを設定します。

   ```dotenv
   PORT=3000
   AIAND_BASE_URL=https://api.aiand.com/v1
   AIAND_API_KEY=ここにAPIキーを設定
   AIAND_MODEL=moonshotai/kimi-k2.7-code
   ```

3. サーバーを再起動します。

   ```bash
   npm start
   ```

4. 案件を選び、「KIMIで再分析」を押します。

APIキーはブラウザへ渡さず、必ず`.env`などサーバー側の秘密情報として管理してください。`public/app.js`、URL、README、GitのコミットへAPIキーを書かないでください。`.env`は`.gitignore`で除外され、`.env.example`にはダミー値だけが入っています。

接続先は次の通りです。

```text
Base URL: https://api.aiand.com/v1
Endpoint: /chat/completions
Model: moonshotai/kimi-k2.7-code
```

## デモの進め方

### 1. 申込みキューを見る

左側に50件の案件が表示されます。各行にはタイトル、企業名、第1希望日、デモ用ステータスが表示されます。

### 2. 案件を選ぶ

案件をクリックすると、そのCSV行の内容が詳細画面へ反映されます。同梱データでは、申込IDが`SDS-CSV-001`から`SDS-CSV-050`まで振られます。

### 3. 分析結果を確認する

上から順番に次を確認します。

1. 申込メタデータと情報充足率。
2. SDSとの適合性整理。
3. 空き候補日と施設条件。
4. 推奨する追加質問。
5. 匿名の会員・パートナー候補と役割。
6. 運営タスク。
7. 申込者への返信案。

### 4. 再計画を見せる

「条件変更を試す」を押すと第1希望日が使えないケースになります。「利用困難」と代替候補が表示されるため、検索、判断、再計画の流れをデモできます。

### 5. KIMIを見せる

APIキーを設定し、案件を選んで「KIMIで再分析」を押します。KIMIの応答が正常に統合されると、分析カードに「KIMI分析」と表示されます。

## CSVの項目対応

同梱CSVはUTF-8形式で、ヘッダー1行とデータ50行、26列です。

| 番号 | 項目 | 内部プロパティ |
| ---: | --- | --- |
| 1 | 企業・団体名 | `company` |
| 2 | 担当者所属 | `department` |
| 3 | 担当者氏名 | `contactName` |
| 4 | 氏名よみがな | `contactKana` |
| 5 | 電話番号 | `phone` |
| 6 | メールアドレス | `email` |
| 7 | 主催者名 | `organizer` |
| 8 | 共催者・協賛者・協力者 | `coOrganizer` |
| 9 | 開催目的 | `purpose` |
| 10 | ディープテック分野 | `deeptechArea` |
| 11 | 開催方式 | `eventType` |
| 12 | イベント参加方法 | `participation` |
| 13 | イベントタイトル | `title` |
| 14 | 第1希望日 | `firstDate` |
| 15 | 第2希望日 | `secondDate` |
| 16 | 開始予定時刻 | `startTime` |
| 17 | 終了予定時刻 | `endTime` |
| 18 | 規模・人数 | `attendeeCount` |
| 19 | 参加費 | `fee` |
| 20 | 使用言語 | `language` |
| 21 | 通訳 | `interpretation` |
| 22 | 参加対象者 | `attendees` |
| 23 | 開催内容詳細 | `details` |
| 24 | 機材搬入 | `equipment` |
| 25 | 飲食提供 | `food` |
| 26 | SDSを知ったきっかけ | `discovery` |

現在のCSVには、準備・撤去時間、アルコール提供の有無、SDSに希望する支援内容がありません。そのため、エージェントはこれらを追加質問として表示します。将来のCSVで列を追加する場合は、内部的には`setupTime`、`alcohol`、`sdsSupport`に対応させます。

### デモCSVを差し替える

次の2通りがあります。

1. `public/data/sds_event_request_sample_50.csv`を差し替えてサーバーを再起動する。
2. サイドバーの「CSVを取り込む」から同形式のCSVを選択する。

番号付きのフォームヘッダーを優先して認識し、いくつかの日本語・英語ヘッダー別名にも対応しています。

## HTTP API

### `GET /api/health`

APIキーそのものを返さず、サーバー状態とKIMI設定状態だけを返します。

```json
{
  "ok": true,
  "kimiConfigured": false,
  "model": "moonshotai/kimi-k2.7-code"
}
```

### `POST /api/analyze`

正規化された1件の申込オブジェクトを受け取り、通常処理の分析結果と、利用可能ならKIMIの応答を統合して返します。

APIキー未設定時の`mode`は`demo`、KIMI応答を統合した場合の`mode`は`kimi`です。

## 安全性・個人情報の境界

これはデモ用MVPであり、本番の予約システムではありません。

- 予約確定メールは送信しません。
- 申込者・会員への自動連絡はしません。
- 会員の個人情報や連絡先は公開しません。
- デモの会員候補は「事業会社A」などの匿名ラベルです。
- KIMI APIキーをブラウザへ返しません。
- 開催承認、予約確定、外部連絡は人間の操作として残します。
- 実在の個人情報をリポジトリやスクリーンショットへ入れないでください。

同梱CSVのメールアドレスは`example.com`などのデモ値です。公開用の追加データを作る場合も、必ず架空データを使ってください。

## 検証済みの内容

次のチェックを実行しています。

```bash
node --check public/app.js
node --check server.mjs
git diff --check
curl http://localhost:3000/api/health
```

ローカル画面では、次を確認しています。

- 起動後に50件が表示される。
- 同梱CSVの1件目が初期表示される。
- 50件目を選択できる。
- 条件変更で「利用困難」と「代替候補」が表示される。
- これらの操作でブラウザのエラーが出ない。

## 制約と次の拡張

このMVPは、ハッカソンでエンドツーエンドの価値を見せやすいように、小さなデモルールと匿名候補を使っています。本番化では次を追加します。

- 実際の施設カレンダー、営業時間、設備データとの接続
- SDSの施設ポリシーに基づく人数・設備・飲食条件の判定
- 運営担当者の認証と権限管理
- AI分析、編集、判断履歴の監査ログ
- 案件、タスク、期限、担当者の永続化
- 権限付き会員ディレクトリ検索
- 運営承認を必須とする匿名紹介フロー
- 申込者向けの回答分岐フォーム
- KIMI APIのタイムアウト、再試行、スキーマ検証
- 実際の過去申込みデータによる評価
- マネージドな秘密情報ストアを使ったデプロイ設定

## リポジトリ構成

```text
.
├── .env.example
├── .gitignore
├── package.json
├── server.mjs
├── README.md
└── public
    ├── app.js
    ├── data
    │   └── sds_event_request_sample_50.csv
    ├── index.html
    ├── styles.css
    └── assets
        ├── dashboard-overview.jpg
        └── analysis-detail.jpg
```

## ライセンスとデモ状態

このリポジトリは、SDS Event Producer Agent構想のハッカソン・デモMVPです。本番配布する場合は、プロジェクトに合ったライセンスを追加してください。
