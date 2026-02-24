# Serverless SPA Construct - サンプルプロジェクト

このリポジトリは、SPA向けサーバーレス構成をデプロイするCDKカスタムコンストラクトの動作確認用サンプルです。

## 目的

- カスタムコンストラクトの開発・テスト
- 実際のAWS環境へのデプロイ検証
- 将来的なnpm公開に向けた準備（公開は別リポジトリで実施予定）

## アーキテクチャ

```
                                    ┌─────────────────┐
                                    │  Cognito        │
                                    │  User Pool      │
                                    │  (JWT発行)      │
                                    └────────┬────────┘
                                             │ JWT検証
┌──────┐    ┌─────────────┐    ┌─────────────┴────────────┐
│ User │───▶│ CloudFront  │───▶│ API Gateway (REST)       │
└──────┘    │             │    │ - リソースポリシー       │
            │ /api/* ─────┼───▶│ - Cognito Authorizer     │
            │             │    └─────────────┬────────────┘
            │ /* ─────────┼───┐              │
            └─────────────┘   │              ▼
                              │    ┌─────────────────┐
                              │    │ Lambda          │
                              │    │ (Node.js)       │
                              │    └────────┬────────┘
                              │             │
                              ▼             ▼
                    ┌─────────────┐  ┌─────────────┐
                    │ S3 Bucket   │  │ DynamoDB    │
                    └─────────────┘  └─────────────┘
```

## スタック構成

このサンプルでは2つのスタックをデプロイします。

| スタック                     | リージョン     | 説明                             |
| ---------------------------- | -------------- | -------------------------------- |
| `ServerlessSpaSecurityStack` | us-east-1      | WAF、シークレット、SSMパラメータ |
| `ServerlessSpaMainStack`     | ap-northeast-1 | メインアプリケーション           |

## セットアップ

```bash
npm install
```

## デプロイ

```bash
# 1. セキュリティスタック（us-east-1）を先にデプロイ
npx cdk deploy ServerlessSpaSecurityStack

# 2. メインスタックをデプロイ
npx cdk deploy ServerlessSpaMainStack

# または両方同時に（依存関係は自動解決）
npx cdk deploy --all
```

## 削除

```bash
npx cdk destroy --all
```

## プロジェクト構成

```
├── bin/
│   └── serverless-spa-construct-test.ts    # CDKアプリエントリーポイント
├── lib/
│   ├── constructs/                         # カスタムコンストラクト
│   │   ├── serverless-spa.ts               # 高レベルAPI
│   │   ├── serverless-spa-security-construct.ts
│   │   ├── frontend-construct.ts           # 低レベルAPI: S3 + CloudFront
│   │   ├── auth-construct.ts               # 低レベルAPI: Cognito
│   │   ├── api-construct.ts                # 低レベルAPI: API Gateway + Lambda
│   │   ├── database-construct.ts           # 低レベルAPI: DynamoDB
│   │   ├── lambda-edge-construct.ts        # Lambda@Edge
│   │   ├── waf-construct.ts                # WAF
│   │   ├── secret-construct.ts             # Secrets Manager
│   │   └── ssm-construct.ts                # SSM Parameter Store
│   ├── lambda/                             # Lambda関数ソース
│   │   ├── custom-header-authorizer.ts     # カスタムヘッダー認可
│   │   ├── edge-origin-request.ts          # Edge オリジンリクエスト
│   │   └── rotation-handler.ts             # シークレットローテーション
│   ├── serverless-spa-main-stack.ts        # メインスタック定義
│   ├── serverless-spa-security-stack.ts    # セキュリティスタック定義
│   └── index.ts                            # エクスポート
├── lambda/
│   └── handler.ts                          # サンプルLambdaハンドラー
├── spa/                                    # フロントエンドSPA（Vite + React）
│   ├── src/
│   │   ├── pages/                          # ページコンポーネント
│   │   ├── App.tsx
│   │   ├── AuthContext.tsx                  # 認証コンテキスト
│   │   ├── auth.ts                         # Cognito認証ロジック
│   │   ├── config.ts
│   │   ├── main.tsx
│   │   └── ProtectedRoute.tsx              # 認証ガード
│   ├── index.html
│   └── vite.config.ts
└── test/                                   # テスト
    ├── constructs/                         # コンストラクトテスト
    └── lambda/                             # Lambda関数テスト
```

## コマンド

| コマンド         | 説明                           |
| ---------------- | ------------------------------ |
| `npm run build`  | TypeScriptコンパイル           |
| `npm run watch`  | ウォッチモード                 |
| `npm test`       | テスト実行                     |
| `npm run lint`   | ESLintチェック                 |
| `npm run format` | Prettierフォーマット           |
| `npx cdk synth`  | CloudFormationテンプレート出力 |
| `npx cdk diff`   | 差分確認                       |
| `npx cdk deploy` | デプロイ                       |

## ライセンス

MIT
