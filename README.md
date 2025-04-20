# Mastraを用いたAIエージェントのバッチ処理の実装例

多数のWebサイトに対し、AIエージェントによる定型作業を実施するMastraを用いた実装例を示す。

- 調査対象のサイトの管理や調査結果の記録はGoogleスプレッドシートで行う
- Playwright MCPを用いてAIエージェントがブラウザ操作を行う
- BRAVE Search MCPを用いて必要に応じてWeb検索を行う
- Mastraにより、AIエージェントとワークフローの実装、上記ツール群との統合を行う

## 動作の様子

時間がかかるため8倍速としている。

<iframe width="560" height="315" src="https://www.youtube.com/embed/L8bhufrv9Bc?si=1_MNefQKKGQ5mfa-" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## 動作させるまで

プロジェクトを`git clone`した後、以下の手順で動作を確認できる。

### モジュールのインストール

```bash
pnpm install
# yarn install
```

### 環境変数ファイルの複製

1. `.env.example` を `.env.development` として複製する

### Googleスプレッドシートとサービスアカウントの用意

タスクおよび結果管理用のスプレッドシートと、プログラムから編集するためのサービスアカウントを用意する。

1. 次のスプレッドシートを自身のドライブに複製する <https://docs.google.com/spreadsheets/d/18zsKxNYNU7uzq2YD2_YaHB3eVT53hch-MFR2tl-rtiw/edit?usp=sharing>
2. GCPでサービスアカウントを作成し(権限設定は不要)、JSON形式の鍵を任意のディレクトリに保存する(例 `/Users/xxxx/service-account.json`)
3. スプレッドシートをサービスアカウントのメールアドレス(例 `spreadsheet-access@ideamans.iam.gserviceaccount.com`)に、編集者として共有する
4. `.env.development` に次の変数を設定する
   - `GOOGLE_APPLICATION_CREDENTIALS=` にJSON鍵のパス(例 `/Users/xxxx/service-account.json`)
   - `GOOGLE_SPREADSHEET_ID=` に複製したスプレッドシートのID(例 `18zsKxNYNU7uzq2YD2_YaHB3eVT53hch-MFR2tl-rtiw`)

### Gemini APIキーの設定

1. [AI Studio](https://aistudio.google.com/prompts/new_chat) でGeminiのAPIキーを取得する
2. `.env.development` に `GOOGLE_GENERATIVE_AI_API_KEY=` としてAPIキーを設定する

### Brave Web Search APIキーの設定

1. [Brave Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started))のAPIキーを取得する
2. `.env.development` に `BRAVE_API_KEY=` としてAPIキーを設定する。

### Mastraサーバーの起動

MastraのPlayground UIを起動する。

```bash
pnpm dev
# yarn dev
```

ワークフローを開く。

<http://localhost:4111/workflows/batchWorkflow/graph>

`Trigger`ボタンを押すと次の処理が始まる。

1. Googleスプレッドシートから未処理のドキュメントを取得する
2. PlayWright MCP経由のブラウザで対象URLを開く
3. 開いたページが名前と一致するか確認し、一致しない場合はWeb検索を用いて訂正する
4. 開いたページにアクセスランキングがあるか判定する
5. アクセスランキングの有無とアクセスランキングの名称をGoogleスプレッドシートに書き込む
6. 上記の処理を未処理のドキュメントがなくなるまで繰り返す

### リトライするには

`状態`の列が空だと未処理だと判定している。

Googleスプレッドシートで、`状態`、`アクセスランキングの有無`、`アクセスランキングの名称`の列の値を削除して`Trigger`ボタンを押すと、一連の処理を再実行できる。

## 調査内容をカスタマイズするには

コメントにキーワード「改造ポイント」を記した。以下のファイルを変更することで、異なる調査にも転用できる。

### AIエージェントの動作 `src/mastra/agents/survey.ts`

このファイルにAIエージェントの挙動を示したシステムプロンプトがある。

これをカスタマイズすることで調査内容を変更できる。

### ドキュメントのフォーマット `src/mastra/tools/documents.ts`

`dataSchema`がGoogleスプレッドシートのフィールド構造と、プログラム上におけるデータ構造とを揃えている。

AIエージェントのシステムプロンプトの変更はGoogleスプレッドシートのフォーマットにも関係する。

シートの1行目とこのスキーマを揃えて変更することで、記録するドキュメントのスキーマを変更できる。

なお、`headers`スクリプトで`dataSchema`のフィールドをタブ区切りテキストで出力できる。

```bash
pnpm headers
# yarn headers
```

### プロンプトと更新データ `src/mastra/workflows/batch.ts`

それぞれのサイトごとの処理に必要なプロンプトと、調査結果をGoogleスプレッドシートに書き込む際のデータ構造はこのファイルで変更する。

プロンプトの変更は少ないと思われるが、ドキュメントのフォーマット変更は更新データの変更を伴う。

## 他のモデルを使うには

このプログラムでは安価な`gemini-2.0-flash-001`を指定しているが、Function Callingと構造化出力に対応したLLMであれば代替できる。

他のモデルを利用するには以下のファイルを更新する。

- `.env.development` モデル向けのAPIキーを設定
- `src/mastra/agents/models.ts` 候補となるモデルの一覧
- `src/mastra/agents/survey.ts` 調査エージェントのモデルを指定
- `src/mastra/agents/structure.ts` 調査結果の構造化エージェントのモデルを指定
