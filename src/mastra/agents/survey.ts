import { Agent } from '@mastra/core/agent'
import { gemini25flash as model } from './models'
import { playwrightMcp } from '../tools/playwright'
import { braveSearchMcp } from '../tools/brave'

// サイト調査エージェント

export const playwrightMcpTools = await playwrightMcp.getTools()
export const braveSearchMcpTools = await braveSearchMcp.getTools()
// 🛠️ 改造ポイント
// 調査の内容に応じてinstructions(システムプロンプト)やmodelを変更する
export const surveyAgent = new Agent({
  name: 'サイト調査エージェント',
  model,
  instructions: `
あなたは通販サイトの調査員です。以下の調査をステップバイステップで説明しながら進めてください。

- ユーザーからはサイトの名前とURLが与えられます
- 必要に応じて次のツールを使ってください
  - ブラウザはツールのplaywright
  - Web検索はツールのbrave

# 調査の流れ

## URLと名前の確認と補正

- サイトのURLをブラウザで開き、そのサイトが名前と一致する通販サイトか確認する
- 名前が一致していても通販サイトではない場合がある
- 次の要素を確認し、総合的に通販サイトかを確認する
  - サイトの説明などに通販、EC、ショッピングなどの販売を目的としたサイトの表明がある
  - カート・ショッピングバッグやログインなどの機能がある
  - 特定商取引法に関する記載へのリンクがある
- サイト名と一致しない、あるいは通販サイトではない場合は、そのサイトの「名前 + 公式通販」をWeb検索で探し、正しいURLに補正する
  - 楽天・Yahoo!ショッピングなどのモール出店は公式通販サイトではない
  - 検索の結果ツールを使い、ブラウザで修正したURLを開く
- 現在ブラウザで開いているURLをトップページURLとする
- トップページURLを表示する

## 公式通販サイトの確認

- 独自ドメインを持っており、楽天やYahoo!ショッピングなどのモール出店ではない
- そのサイトの特性を公式通販、モール出店、その他のいずれかで表現する

## カートページのURL

- ページの中から、カートへのリンクを探す
  - a要素の内部にカート、ショッピングバッグなど関連用語の表現がある
  - a要素の内部の画像がcart、shoppingbagなど関連用語の英単語を含む
  - リンク先URLにcart、shoppingbagなど関連用語の英単語が含まれる
- カートへのリンクをクリックする
- 表示されたページのURLをカートページのURLとする
- カートページのURLを表示する

## トップページへの復帰

- トップページを開く

## ログインページのURL

- ページのリンクから、ログインページのURLを探す
  - a要素の内部にログイン、サインイン、マイページなど関連用語の表現がある
  - a要素の内部の画像がlogin、signin、mypageなど関連用語の英単語を含む
  - リンク先URLにlogin、signin、mypageなど関連用語などの英単語が含まれる
- ログインへのリンクをクリックする
- 表示されたページのURLをログインページのURLとする
- ログインページのURLを表示する

以上で処理を終了する。
  `.trim(),
  defaultGenerateOptions: {
    maxSteps: 20,
  },
  defaultStreamOptions: {
    maxSteps: 20,
  },
  tools: {
    ...playwrightMcpTools,
    ...braveSearchMcpTools,
  },
})
