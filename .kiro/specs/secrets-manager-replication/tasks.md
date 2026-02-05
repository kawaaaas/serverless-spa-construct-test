# 実装計画: Secrets Managerレプリケーションによるカスタムヘッダー検証

## 概要

CloudFront → API Gateway間のセキュリティを強化するため、Secrets Managerのマルチリージョンレプリケーションを使用したカスタムヘッダー検証機能を実装する。

## タスク

- [ ] 1. SecretConstructの改修（us-east-1）
  - [x] 1.1 SecretConstructPropsにreplicaRegionsプロパティを追加
    - デフォルト値: `['ap-northeast-1']`
    - us-east-1が指定された場合のバリデーションエラー
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Secrets ManagerのreplicaRegions設定を実装
    - CDKのreplicaRegionsプロパティを使用
    - _Requirements: 1.2, 1.4_
  - [x] 1.3 SecretConstructのユニットテストを更新
    - レプリケーション設定のテンプレートアサーション
    - デフォルトレプリカリージョンのテスト
    - バリデーションエラーのテスト
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Lambda@Edgeハンドラーの実装（us-east-1）
  - [x] 2.1 edge-origin-request.tsハンドラーを作成
    - Secrets Managerからシークレット値を取得
    - メモリキャッシュの実装（TTL付き）
    - Origin Requestにカスタムヘッダーを付与
    - エラーハンドリング（403レスポンス）
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 7.1_
  - [x] 2.2 Lambda@Edgeハンドラーのプロパティテストを作成
    - **Property 1: Lambda@Edgeヘッダー付与**
    - **Validates: Requirements 2.3**
  - [x] 2.3 キャッシュ動作のプロパティテストを作成
    - **Property 3: キャッシュ動作**
    - **Validates: Requirements 2.4, 2.5, 7.4**

- [x] 3. LambdaEdgeConstructの実装（us-east-1）
  - [x] 3.1 LambdaEdgeConstructPropsインターフェースを定義
    - secretArn, customHeaderName, cacheTtlSeconds, removalPolicy
    - _Requirements: 2.1_
  - [x] 3.2 Lambda@Edge関数の作成ロジックを実装
    - cloudfront.experimental.EdgeFunctionを使用
    - us-east-1リージョンバリデーション
    - Secrets Manager読み取り権限の付与
    - 環境変数の設定
    - _Requirements: 2.1, 2.2_
  - [x] 3.3 関数バージョンARNの公開
    - functionVersion: lambda.IVersionを公開
    - _Requirements: 2.1_
  - [x] 3.4 LambdaEdgeConstructのユニットテストを作成
    - Lambda@Edge関数の作成テスト
    - IAMポリシーのテスト
    - リージョンバリデーションのテスト
    - _Requirements: 2.1_

- [x] 4. チェックポイント - Lambda@Edge実装確認
  - すべてのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 5. Lambda Authorizerハンドラーの実装（ap-northeast-1）
  - [x] 5.1 custom-header-authorizer.tsハンドラーを作成
    - カスタムヘッダーの存在確認
    - ローカルリージョンのSecrets Managerレプリカからシークレット値を取得
    - メモリキャッシュの実装（TTL付き）
    - ヘッダー値の検証
    - Allow/Deny IAMポリシーの生成
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.2_
  - [x] 5.2 Lambda Authorizerのプロパティテストを作成
    - **Property 2: Lambda Authorizer認可判定**
    - **Validates: Requirements 3.4, 3.5, 3.6**

- [x] 6. ApiConstructの改修（ap-northeast-1）
  - [x] 6.1 ApiConstructPropsにLambda Authorizer関連プロパティを追加
    - enableLambdaAuthorizer, authorizerCacheTtlSeconds
    - _Requirements: 4.1_
  - [x] 6.2 Lambda Authorizer関数の作成ロジックを実装
    - secretArnが提供された場合のみ作成
    - Secrets Managerレプリカ読み取り権限の付与
    - シークレットARNのリージョン変換ロジック
    - _Requirements: 4.1, 4.4_
  - [x] 6.3 RequestAuthorizerの設定を実装
    - identitySourcesにカスタムヘッダーを指定
    - Cognito Authorizerとの併用設定
    - _Requirements: 4.2_
  - [x] 6.4 リソースポリシーの維持を確認
    - 既存のリソースポリシーを変更しない
    - _Requirements: 4.3, 4.5_
  - [x] 6.5 ApiConstructのユニットテストを更新
    - Lambda Authorizer作成のテスト
    - Cognito Authorizerとの併用テスト
    - リソースポリシー維持のテスト
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. チェックポイント - Lambda Authorizer実装確認
  - すべてのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 8. FrontendConstructの改修（ap-northeast-1）
  - [x] 8.1 FrontendConstructPropsにedgeFunctionVersionプロパティを追加
    - lambda.IVersion型
    - _Requirements: 5.1_
  - [x] 8.2 CloudFrontのOrigin Request Lambda@Edge設定を実装
    - edgeFunctionVersionが提供された場合のみ設定
    - /api/\*ビヘイビアにLambda@Edgeを関連付け
    - _Requirements: 5.1_
  - [x] 8.3 静的カスタムヘッダー設定の条件分岐を実装
    - edgeFunctionVersion使用時は静的ヘッダーを無効化
    - 後方互換性の維持
    - _Requirements: 5.2, 5.3_
  - [x] 8.4 FrontendConstructのユニットテストを更新
    - Lambda@Edge関連付けのテスト
    - 静的ヘッダー無効化のテスト
    - 後方互換性のテスト
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. ServerlessSpaSecurityConstructの改修（us-east-1）
  - [x] 9.1 ServerlessSpaSecurityConstructPropsにreplicaRegionsとedgeCacheTtlSecondsを追加
    - _Requirements: 6.1_
  - [x] 9.2 LambdaEdgeConstructの統合
    - SecretConstructのsecretArnを渡す
    - _Requirements: 6.1, 6.2_
  - [x] 9.3 SSMパラメータにedge-function-version-arnを追加
    - クロスリージョン参照用
    - _Requirements: 6.2_
  - [x] 9.4 edgeFunctionVersionArnプロパティを公開
    - _Requirements: 6.2_
  - [x] 9.5 ServerlessSpaSecurityConstructのユニットテストを更新
    - LambdaEdgeConstruct統合のテスト
    - SSMパラメータ追加のテスト
    - _Requirements: 6.1, 6.2_

- [x] 10. ServerlessSpaの改修（ap-northeast-1）
  - [x] 10.1 AwsCustomResourceでedge-function-version-arnを取得
    - us-east-1のSSMパラメータから取得
    - _Requirements: 6.3_
  - [x] 10.2 FrontendConstructにedgeFunctionVersionを渡す
    - Lambda.Version.fromVersionArnを使用
    - _Requirements: 6.3_
  - [x] 10.3 ApiConstructにsecretArnを渡す（既存機能の確認）
    - _Requirements: 6.4_
  - [x] 10.4 ServerlessSpaのユニットテストを更新
    - クロスリージョン参照のテスト
    - Lambda@Edge統合のテスト
    - _Requirements: 6.3, 6.4_

- [x] 11. 最終チェックポイント
  - すべてのテストが通ることを確認し、質問があればユーザーに確認する

## 備考

- 各タスクは設計書の要件を参照
- プロパティテストは100回以上の反復実行を設定
- コード・コメントは英語で記述
