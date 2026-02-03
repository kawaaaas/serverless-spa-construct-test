# アーキテクチャ詳細

## リソース構成図

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
                              │    │ モノリス構成    │
                              │    └────────┬────────┘
                              │             │
                              ▼             ▼
                    ┌─────────────┐  ┌─────────────┐
                    │ S3 Bucket   │  │ DynamoDB    │
                    │ (静的ファイル)│  │ (シングル   │
                    │ Viteビルド  │  │  テーブル)  │
                    └─────────────┘  └─────────────┘
```

## CloudFront設定

- デフォルトビヘイビア: S3オリジン（静的ファイル）
- `/api/*` ビヘイビア: API Gatewayオリジン
- カスタムヘッダー付与（API Gateway制限用）
- カスタマイズ: DistributionPropsで上書き可能

## API Gateway設定

- タイプ: REST API（リソースポリシー使用のため）
- リソースポリシー: カスタムヘッダー検証でCloudFrontからのみ許可
- 認可: Cognito User Pool Authorizer（JWT検証）
- カスタマイズ: RestApiPropsで上書き可能

## Cognito設定

- User Poolのみ使用（Identity Poolは不使用）
- フロントエンドでJWT取得 → API Gatewayで検証
- ソーシャルログイン・MFAは初期実装では対象外
- カスタマイズ: UserPoolProps, UserPoolClientPropsで上書き可能

## Lambda設定

- ランタイム: Node.js（NodejsFunction使用）
- 構成: モノリス（単一Lambda）
- 初期実装: 200を返すだけのシンプルな実装
- カスタマイズ: NodejsFunctionPropsで上書き可能

## DynamoDB設定

- 設計: シングルテーブル設計（デフォルト）
- キャパシティ: オンデマンド（最安構成）
- キー設計: PK/SKで汎用的に使用可能な構造（デフォルト）
- カスタマイズ:
  - partitionKey/sortKeyの変更可能
  - GSI/LSIの追加可能
  - TablePropsで詳細設定可能

## セキュリティ考慮事項

- API GatewayはCloudFront経由のみアクセス可能
- 認証済みユーザーのみAPIアクセス可能
- S3バケットは直接アクセス不可（OAC使用）
