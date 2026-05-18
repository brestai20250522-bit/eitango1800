# 英単語1800 PWA

日本語UIの4択英単語学習PWAです。学習者はブラウザで利用し、学習履歴は端末内に保存されます。

## 開発

```bash
npm install
npm run dev
```

ローカル確認用URL:

```text
http://127.0.0.1:5173/
```

## 単語データ更新

学習者向け画面にはExcelアップロード機能を出しません。管理者がExcelを更新し、JSONへ変換してから公開します。

```bash
npm run import:words
```

既定ではデスクトップ上の `英単語1800アプリ用リスト.xlsx` を読み込みます。別ファイルを使う場合:

```bash
node scripts/import-words.mjs "C:/path/to/英単語1800アプリ用リスト.xlsx"
```

変換後は `src/data/words.json` をコミットします。CIではExcelを読み込まず、コミット済みJSONを使ってビルドします。

## 確認

```bash
npm run check
```

このコマンドはテストと本番ビルドを実行します。

## GitHub Pages公開

1. GitHubリポジトリにpushします。
2. GitHubの `Settings > Pages` で `Build and deployment` を `GitHub Actions` にします。
3. `main` ブランチへpushすると `.github/workflows/deploy.yml` が実行され、`dist` が公開されます。

Viteの `base` は `./` にしているため、GitHub Pagesのサブパス公開に対応しています。
