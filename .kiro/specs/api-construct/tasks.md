# 実装計画: ApiConstruct

## 概要

API Gateway（REST）とLambda関数を作成する低レベルCDKコンストラクトを実装する。CloudFront経由のみアクセス可能なセキュアなAPI構成を提供し、オプションでCognito認証をサポートする。

## タスク

- [ ] 1. ApiConstructの基本実装
  - [ ] 1.1 ApiConstructPropsインターフェースを定義する
    - table: ITable（必須）
    - userPool?: IUserPool（オプション）
    - customHeaderName?: string（デフォルト: 'x-origin-verify'）
    - customHeaderSecret?: string（デフォルト: UUID生成）
    - lambdaProps?: Partial<NodejsFunctionProps>
    - restApiProps?: Partial<RestApiProps>
    - JSDocコメントでデフォルト値を明記
    - _要件: 1.5, 2.7, 4.1, 5.1, 5.4, 5.5_
  - [ ] 1.2 ApiConstructクラスの基本構造を実装する
    - Constructを継承
    - 公開プロパティ: api, handler, apiUrl, customHeaderName, customHeaderSecret
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 2. Lambda関数の実装
  - [ ] 2.1 Lambdaハンドラーファイルを作成する
    - lib/lambda/handler.ts
    - シンプルな200レスポンスを返す実装
    - _要件: 2.1_
  - [ ] 2.2 NodejsFunctionを作成する
    - Node.js 20.xランタイム
    - デフォルトメモリ: 128MB
    - デフォルトタイムアウト: 30秒
    - 環境変数: TABLE_NAME
    - DynamoDBテーブルへの読み書き権限を付与
    - lambdaPropsによる上書き機能
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3. REST APIの実装
  - [ ] 3.1 REST APIを作成する
    - リソースポリシーでカスタムヘッダー検証を設定
    - デフォルトCORSを有効化
    - restApiPropsによる上書き機能
    - _要件: 1.1, 1.2, 1.4, 1.5, 5.2_
  - [ ] 3.2 プロキシ統合を設定する
    - ルートパス（/）にANYメソッドを設定
    - {proxy+}リソースを作成しANYメソッドを設定
    - Lambda関数とプロキシ統合
    - _要件: 3.1, 3.2, 3.3_

- [ ] 4. Cognito認証の実装（オプション）
  - [ ] 4.1 Cognito Authorizerを実装する
    - userPool指定時のみCognito Authorizerを作成
    - 全エンドポイントにAuthorizerを適用
    - userPool未指定時は認証なし
    - _要件: 4.1, 4.2, 4.3_

- [ ] 5. チェックポイント - 実装確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [ ] 6. ユニットテスト実装
  - [ ] 6.1 REST API作成テストを実装する
    - REST APIリソースが作成されること
    - リソースポリシーが設定されること
    - CORSが有効であること
    - _要件: 1.1, 1.2, 1.4_
  - [ ] 6.2 Lambda関数テストを実装する
    - Lambda関数が作成されること
    - Node.js 20.xランタイムが設定されること
    - デフォルトメモリ・タイムアウトが設定されること
    - TABLE_NAME環境変数が設定されること
    - DynamoDB読み書き権限が付与されること
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ] 6.3 API Gateway統合テストを実装する
    - プロキシ統合が設定されること
    - {proxy+}リソースが作成されること
    - ANYメソッドが設定されること
    - _要件: 3.1, 3.2, 3.3_
  - [ ] 6.4 Cognito認証テストを実装する
    - userPool指定時にCognito Authorizerが作成されること
    - userPool未指定時にAuthorizerが作成されないこと
    - _要件: 4.1, 4.2, 4.3_
  - [ ] 6.5 カスタムヘッダーテストを実装する
    - デフォルトヘッダー名が使用されること
    - カスタムヘッダー名・シークレットが指定できること
    - _要件: 5.1, 5.3, 5.4, 5.5_
  - [ ] 6.6 Props上書きテストを実装する
    - restApiPropsでデフォルト設定が上書きされること
    - lambdaPropsでデフォルト設定が上書きされること
    - _要件: 1.5, 2.7_
  - [ ] 6.7 出力プロパティテストを実装する
    - api, handler, apiUrl, customHeaderName, customHeaderSecretが公開されること
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. エクスポート設定
  - [ ] 7.1 lib/index.tsにApiConstructをエクスポートする
    - ApiConstruct, ApiConstructPropsをエクスポート

- [ ] 8. 最終チェックポイント
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

## 備考

- 実装言語: TypeScript
- テストフレームワーク: Jest + CDK Assertions
- ファイル配置:
  - lib/constructs/api-construct.ts
  - lib/lambda/handler.ts
  - test/constructs/api-construct.test.ts
