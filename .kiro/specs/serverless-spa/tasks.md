# 実装計画: ServerlessSpa

## 概要

ServerlessSpaは、DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトを統合する高レベルCDKコンストラクトである。依存関係の自動接続（Auto-wiring）、Props透過的転送、RemovalPolicyとタグの一括適用機能を実装する。

## 前提条件

- DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructが実装済みであること
- TypeScript + CDK環境がセットアップ済みであること

## タスク

- [x] 1. ServerlessSpaPropsインターフェースの定義
  - database, auth, api, frontendの各Propsを定義
  - removalPolicyプロパティを定義（デフォルト: DESTROY）
  - tagsプロパティを定義
  - Omit型を使用してAuto-wiredプロパティを除外
  - _要件: 3.1, 3.2, 3.3, 3.4, 7.1, 8.1_

- [x] 2. ServerlessSpaクラスの基本構造を実装
  - [x] 2.1 クラス定義と出力プロパティの宣言
    - database, auth, api, frontendプロパティを宣言
    - 便利プロパティ（distributionDomainName, apiUrl, userPoolId, userPoolClientId, tableName）を宣言
    - _要件: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 2.2 タグ適用ロジックの実装
    - Tags.of(this).add()を使用してタグを一括適用
    - _要件: 8.1, 8.3_

- [x] 3. 低レベルコンストラクトの作成とAuto-wiring
  - [x] 3.1 DatabaseConstructの作成
    - databaseプロパティを透過的に渡す
    - removalPolicyをtablePropsに適用
    - _要件: 1.1, 3.1, 7.1, 7.2_
  - [x] 3.2 AuthConstructの作成
    - authプロパティを透過的に渡す
    - _要件: 1.2, 3.2_
  - [x] 3.3 ApiConstructの作成
    - DatabaseConstruct.tableを自動接続
    - AuthConstruct.userPoolを自動接続
    - apiプロパティを透過的に渡す
    - _要件: 1.3, 2.1, 2.2, 3.3_
  - [x] 3.4 FrontendConstructの作成
    - ApiConstruct.apiを自動接続
    - ApiConstruct.customHeaderName/Secretを自動接続
    - frontendプロパティを透過的に渡す
    - removalPolicyに基づいてautoDeleteObjectsを設定
    - _要件: 1.4, 2.3, 2.4, 2.5, 3.4, 7.3, 7.4_

- [x] 4. 便利プロパティの設定
  - distributionDomainName = frontend.distributionDomainName
  - apiUrl = api.apiUrl
  - userPoolId = auth.userPoolId
  - userPoolClientId = auth.userPoolClientId
  - tableName = database.tableName
  - _要件: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. チェックポイント - 実装の確認
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

- [x] 6. プロパティテストの実装
  - [x] 6.1 全コンストラクト作成テスト
    - DynamoDB、Cognito、API Gateway、Lambda、S3、CloudFrontが作成されることを確認
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_
  - [x] 6.2 Auto-wiringテスト
    - LambdaがDynamoDBへの権限を持つことを確認
    - Cognito Authorizerが作成されることを確認
    - CloudFrontの/api/\*ビヘイビアを確認
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 6.3 Props透過的転送テスト
    - 各Propsが正しく渡されることを確認
    - _要件: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.4 出力プロパティテスト
    - 全プロパティが正しく公開されることを確認
    - _要件: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 6.5 RemovalPolicyテスト
    - デフォルトDESTROYの確認
    - カスタムRemovalPolicyの適用確認
    - autoDeleteObjectsの条件付き設定確認
    - _要件: 7.1, 7.2, 7.3, 7.4_
  - [x] 6.6 タグテスト
    - タグが全リソースに適用されることを確認
    - _要件: 8.1, 8.3_

- [x] 7. index.tsへのエクスポート追加
  - ServerlessSpaとServerlessSpaPropsをエクスポート
  - _要件: なし（公開API）_

- [x] 8. 最終チェックポイント
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

## 備考

- 低レベルコンストラクト（DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstruct）が先に実装されている必要がある
- テストはCDK Assertionsを使用（プロパティベーステストは不要）
- コードは英語、コメントは英語で記述
