# Serverless SPA Demo

CDKスタックとの疎通確認用SPAです（React + TypeScript + Vite）。  
Cognito認証 → API Gateway呼び出しの一連のフローを確認できます。  
未認証時は自動的にログインページへリダイレクトされます。

## 前提条件

- Node.js 18+
- CDKスタックがデプロイ済みであること

## セットアップ

```bash
cd spa
npm install
```

## 設定

`src/config.ts` を編集し、デプロイ済みスタックの値を設定してください。

```ts
export const config = {
  USER_POOL_ID: 'ap-northeast-1_XXXXXXXXX',
  USER_POOL_CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
  API_BASE_URL: '',
} as const;
```

値は以下のコマンドで確認できます:

```bash
aws cloudformation describe-stacks --stack-name <STACK_NAME> --query 'Stacks[0].Outputs'
```

## ローカル開発

```bash
npm run dev
```

ローカルで動作確認する場合は `API_BASE_URL` にAPI GatewayのURLを直接指定してください。  
（CORS設定が必要です）

## ビルド & S3アップロード

### 1. ビルド

```bash
npm run build
```

`dist/` ディレクトリにビルド成果物が出力されます。

### 2. S3バケット名の確認

```bash
aws cloudformation describe-stacks \
  --stack-name <STACK_NAME> \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Bucket`) || contains(OutputKey, `S3`)].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

### 3. S3にアップロード

```bash
aws s3 sync dist/ s3://<BUCKET_NAME>/ --delete
```

`--delete` により、S3上の不要なファイルも削除されます。

### 4. CloudFrontキャッシュの無効化（必要に応じて）

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

Distribution IDもCloudFormation Outputsから確認できます。

## 動作確認手順

1. CloudFront URLにアクセス → ログインページにリダイレクト
2. 「Sign Up」でアカウント作成
3. メールに届いた確認コードを入力
4. サインイン → ホームページへ遷移
5. 「Call /api/」ボタンでAPI疎通を確認
6. レスポンスに `invocationCount` が表示されれば成功

## ファイル構成

```
spa/
├── index.html
├── src/
│   ├── main.tsx            # Entry point
│   ├── App.tsx             # Router setup
│   ├── AuthContext.tsx      # Auth state (React Context)
│   ├── ProtectedRoute.tsx   # Auth guard
│   ├── auth.ts             # Cognito wrapper
│   ├── config.ts           # Settings (edit this)
│   ├── vite-env.d.ts
│   └── pages/
│       ├── LoginPage.tsx    # Sign in / Sign up / Confirm
│       └── HomePage.tsx     # API test
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```
