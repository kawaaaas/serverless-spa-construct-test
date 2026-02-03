# プロジェクト概要

## 目的

個人開発者向けのCDKカスタムコンストラクトを開発する。
このリポジトリで実際にAWSリソースをデプロイして動作確認を行い、
将来的に別リポジトリでOSSとしてnpm公開することを見据えている。

## コンセプト

SPA向けサーバーレス最安構成を、CDKで簡単にデプロイできるようにする。

## アーキテクチャ概要

```
[User] → [CloudFront] → [S3 (Static Hosting)]
              ↓
         [API Gateway (REST)] → [Lambda] → [DynamoDB]
              ↑
         [Cognito User Pool] (JWT認証)
```

## 主要コンポーネント

- CloudFront: CDN・エントリーポイント
- S3: Viteでビルドした静的ファイルのホスティング
- API Gateway (REST): バックエンドAPI（CloudFrontからのみアクセス可能）
- Cognito User Pool: 認証（JWTトークン発行）
- Lambda: バックエンド処理（Node.js、モノリス構成）
- DynamoDB: データストア（シングルテーブル設計、オンデマンド）

## コンストラクト設計方針

将来のnpm公開を見据え、以下の2層構造で設計する：

- 高レベルAPI: `ServerlessSpa` - 全部入りで一発デプロイ
- 低レベルAPI: `AuthConstruct`, `ApiConstruct`, `FrontendConstruct` - 個別カスタマイズ用

## このリポジトリのスコープ

1. CDKプロジェクトとして実装
2. 実際にAWSにデプロイして動作確認
3. コンストラクトとして再利用可能な形で実装
4. npm公開は別リポジトリで行う（このリポジトリでは公開設定不要）
