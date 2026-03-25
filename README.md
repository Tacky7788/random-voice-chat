# Random Voice Chat

わんコメ用プラグイン。配信のコメントをランダムな音声合成キャラで読み上げます。

コメントが来るたびに違う声で読まれるので、2chショート動画のようなカオスな配信になります。

## 対応エンジン

- **VOICEVOX** — ずんだもん、四国めたん、青山龍星 等 40キャラ以上
- **COEIROINK** — つくよみちゃん、兄口誘太郎、真賢木ミロク 等（MYCOEIROINK含む）

## インストール

### 必要なもの

- [わんコメ](https://onecomme.com) v5.2以上
- [VOICEVOX](https://voicevox.hiroshiba.jp/) および/または [COEIROINK](https://coeiroink.com/)

### 手順

1. [Releases](../../releases) からZIPをダウンロード
2. 解凍して **`install.bat`をダブルクリック**
3. わんコメを再起動

手動の場合は `plugin.js` と `index.html` を `%APPDATA%\onecomme\plugins\random-voice-chat\` にコピーしてください。

## 使い方

1. VOICEVOX（とCOEIROINK）を起動
2. わんコメを起動
3. プラグイン設定からリンクをクリックして設定画面を開く
4. 使いたいキャラにチェックを入れて「保存」

### 設定項目

| 項目 | 説明 |
|------|------|
| 読み上げ有効 | プラグインのON/OFF |
| 同じユーザーは同じ声 | ONにすると同じ人のコメントは同じキャラで読み上げ |
| 速度 | 読み上げ速度（0.5〜2.0） |
| ボリューム | 音量（0〜2.0） |
| ピッチ | 声の高さ（-0.15〜0.15） |
| イントネーション | 抑揚（0〜2.0） |
| 最大文字数 | 長文コメントのカット。「制限なし」で全文読み上げ |
| キャラ選択 | チェックしたキャラからランダムに選ばれます。未選択=全キャラ |

## スクリーンショット

設定画面でキャラをカード形式で選択できます。エンジンごとにフィルタも可能。

## 開発

```bash
npm install
npm run build
```

ビルド成果物は `public/plugin.js` に出力されます。

## ライセンス

MIT

## クレジット

- [わんコメ](https://onecomme.com) — 配信者のためのコメントアプリ
- [VOICEVOX](https://voicevox.hiroshiba.jp/) — 無料の音声合成ソフトウェア
- [COEIROINK](https://coeiroink.com/) — 無料の音声合成ソフトウェア
