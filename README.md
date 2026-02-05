# Serverless SPA Construct

SPA（シングルページアプリケーション）向けのサーバーレス最安構成を、CDKで簡単にデプロイできるカスタムコンストラクトです。

## アーキテクチャ

```
[User] → [CloudFront] → [S3 (静的ホスティング)]
              ↓
         [API Gateway (REST)] → [Lambda] → [DynamoDB]
              ↑
         [Cognito User Pool] (JWT認証)
```

## 主要コンポーネント

| コンポーネント     | 役割                                               |
| ------------------ | -------------------------------------------------- |
| CloudFront         | CDN・エントリーポイント                            |
| S3                 | Viteでビルドした静的ファイルのホスティング         |
| API Gateway (REST) | バックエンドAPI（CloudFrontからのみアクセス可能）  |
| Cognito User Pool  | 認証（JWTトークン発行）                            |
| Lambda             | バックエンド処理（Node.js、モノリス構成）          |
| DynamoDB           | データストア（シングルテーブル設計、オンデマンド） |

## インストール

```bash
npm install
```

## クイックスタート

### 最小構成（CloudFrontデフォルトドメイン）

```typescript
import { ServerlessSpa } from './lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';

ServerlessSpa.minimal(this, 'MyApp', {
  lambdaEntry: './src/api/handler.ts',
  partitionKey: { name: 'PK', type: AttributeType.STRING },
});
```

### カスタムドメイン付き

```typescript
ServerlessSpa.withCustomDomain(this, 'MyApp', {
  lambdaEntry: './src/api/handler.ts',
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  domainName: 'www.example.com',
  hostedZoneId: 'Z1234567890ABC',
  zoneName: 'example.com',
});
```

### WAF保護付き

WAFを使用する場合は、先に `us-east-1` リージョンにセキュリティスタックをデプロイする必要があります。

```typescript
// 1. us-east-1 にセキュリティスタックをデプロイ
const securityStack = new Stack(app, 'SecurityStack', {
  env: { region: 'us-east-1' },
});

new ServerlessSpaSecurityConstruct(securityStack, 'Security', {
  ssm: { ssmPrefix: '/myapp/security/' },
});

// 2. メインスタックでWAF付きのServerlessSpaを作成
ServerlessSpa.withWaf(this, 'MyApp', {
  lambdaEntry: './src/api/handler.ts',
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  ssmPrefix: '/myapp/security/',
});
```

### フル構成（カスタムドメイン + WAF）

```typescript
ServerlessSpa.withCustomDomainAndWaf(this, 'MyApp', {
  lambdaEntry: './src/api/handler.ts',
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  domainName: 'www.example.com',
  hostedZoneId: 'Z1234567890ABC',
  zoneName: 'example.com',
  ssmPrefix: '/myapp/security/',
});
```

## コンストラクト階層

このプロジェクトは高レベルAPIと低レベルAPIの2層構造で設計されています。

### 高レベルAPI

| コンストラクト                   | 説明                                              |
| -------------------------------- | ------------------------------------------------- |
| `ServerlessSpa`                  | 全リソースを一括デプロイ                          |
| `ServerlessSpaSecurityConstruct` | WAF + シークレット + SSMパラメータ（us-east-1用） |

### 低レベルAPI

| コンストラクト      | 説明                                          |
| ------------------- | --------------------------------------------- |
| `FrontendConstruct` | S3 + CloudFront（静的ホスティング）           |
| `AuthConstruct`     | Cognito User Pool（認証）                     |
| `ApiConstruct`      | API Gateway + Lambda（バックエンド）          |
| `DatabaseConstruct` | DynamoDB（データストア）                      |
| `WafConstruct`      | WAF WebACL（CloudFront用）                    |
| `SecretConstruct`   | Secrets Manager + 自動ローテーション          |
| `SsmConstruct`      | SSM Parameter Store（クロスリージョン共有用） |

## 低レベルコンストラクトの個別使用

各コンストラクトは単独でも使用できます。

```typescript
import { DatabaseConstruct, AuthConstruct, ApiConstruct, FrontendConstruct } from './lib';

// DynamoDBテーブル
const database = new DatabaseConstruct(this, 'Database', {
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  sortKey: { name: 'SK', type: AttributeType.STRING },
});

// Cognito認証
const auth = new AuthConstruct(this, 'Auth');

// API Gateway + Lambda
const api = new ApiConstruct(this, 'Api', {
  table: database.table,
  userPool: auth.userPool,
  entry: './src/api/handler.ts',
});

// CloudFront + S3
const frontend = new FrontendConstruct(this, 'Frontend', {
  api: api.api,
  customHeaderName: api.customHeaderName,
  customHeaderSecret: api.customHeaderSecret,
});
```

## セキュリティ

- API GatewayはCloudFront経由のみアクセス可能（カスタムヘッダー検証）
- 認証済みユーザーのみAPIアクセス可能（Cognito JWT検証）
- S3バケットは直接アクセス不可（OAC使用）
- WAF保護（オプション）: レート制限、SQLi対策、共通ルールセット

## コマンド

```bash
# TypeScriptコンパイル
npm run build

# ウォッチモード
npm run watch

# テスト実行
npm test

# スナップショット更新
npm test -- -u

# リント
npm run lint

# フォーマット
npm run format

# CDKデプロイ
npx cdk deploy

# CDK差分確認
npx cdk diff

# CloudFormationテンプレート出力
npx cdk synth
```

## ライセンス

MIT
