# 要件ドキュメント

## はじめに

ApiConstructは、サーバーレスSPAアプリケーション向けのAPI Gateway（REST）とLambda関数を作成する低レベルCDKコンストラクトである。CloudFront経由のみアクセス可能なセキュアなAPI構成を提供し、オプションでCognito Authorizerによる認証をサポートする。モノリス構成のLambda関数がDynamoDBテーブルにアクセスし、バックエンド処理を担当する。

## 用語集

- **ApiConstruct**: API GatewayとLambda関数を作成するCDKコンストラクト
- **RestApi**: AWS API Gateway REST APIリソース
- **Lambda**: AWS Lambda関数リソース
- **NodejsFunction**: esbuildを使用したNode.js Lambda関数のCDKコンストラクト
- **ResourcePolicy**: API Gatewayへのアクセスを制御するリソースポリシー
- **CognitoAuthorizer**: Cognito User PoolのJWTトークンを検証するAPI Gateway Authorizer
- **CustomHeader**: CloudFrontからAPI Gatewayへのリクエストに付与するカスタムヘッダー
- **Props**: コンストラクトの設定パラメータ
- **ITable**: DynamoDBテーブルのインターフェース型
- **IUserPool**: Cognito User Poolのインターフェース型

## 要件

### 要件1: REST API作成

**ユーザーストーリー:** 開発者として、REST APIを簡単に作成したい。CloudFront経由でのみアクセス可能なセキュアなAPIをデプロイできるようにする。

#### 受け入れ基準

1. WHEN ApiConstructがインスタンス化される THEN THE RestApi SHALL REST APIを作成する
2. THE RestApi SHALL リソースポリシーを設定してカスタムヘッダーによるアクセス制限を行う
3. WHEN リクエストに正しいカスタムヘッダーが含まれない THEN THE RestApi SHALL リクエストを拒否する
4. THE RestApi SHALL デフォルトでCORSを有効にする
5. WHEN restApiPropsが指定される THEN THE RestApi SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件2: Lambda関数作成

**ユーザーストーリー:** 開発者として、バックエンド処理を行うLambda関数を作成したい。DynamoDBテーブルにアクセスできるモノリス構成のLambda関数をデプロイする。

#### 受け入れ基準

1. WHEN ApiConstructがインスタンス化される THEN THE Lambda SHALL NodejsFunctionを作成する
2. THE Lambda SHALL 指定されたDynamoDBテーブルへの読み書き権限を持つ
3. THE Lambda SHALL 環境変数としてテーブル名を受け取る
4. THE Lambda SHALL デフォルトでNode.js 20.xランタイムを使用する
5. THE Lambda SHALL デフォルトで128MBのメモリを割り当てる
6. THE Lambda SHALL デフォルトで30秒のタイムアウトを設定する
7. WHEN lambdaPropsが指定される THEN THE Lambda SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件3: API Gateway統合

**ユーザーストーリー:** 開発者として、API GatewayとLambdaを統合したい。全てのリクエストをLambda関数にルーティングする。

#### 受け入れ基準

1. THE RestApi SHALL プロキシ統合でLambda関数と連携する
2. THE RestApi SHALL ルートパス（/）にプロキシリソース（{proxy+}）を設定する
3. THE RestApi SHALL 全てのHTTPメソッドをLambda関数にルーティングする

### 要件4: Cognito認証（オプション）

**ユーザーストーリー:** 開発者として、APIをCognito認証で保護したい。認証済みユーザーのみがAPIにアクセスできるようにする。

#### 受け入れ基準

1. WHEN userPoolが指定される THEN THE RestApi SHALL Cognito Authorizerを作成する
2. WHEN userPoolが指定される THEN THE RestApi SHALL 全てのエンドポイントにCognito Authorizerを適用する
3. WHEN userPoolが指定されない THEN THE RestApi SHALL 認証なしでAPIを公開する

### 要件5: カスタムヘッダーによるアクセス制限

**ユーザーストーリー:** 開発者として、CloudFront経由のみAPIにアクセスできるようにしたい。直接API Gatewayにアクセスすることを防ぐ。

#### 受け入れ基準

1. THE ApiConstruct SHALL カスタムヘッダー名とシークレット値を生成または受け入れる
2. THE RestApi SHALL リソースポリシーでカスタムヘッダーの値を検証する
3. THE ApiConstruct SHALL カスタムヘッダー名とシークレット値を公開する（CloudFront設定用）
4. WHEN customHeaderNameが指定される THEN THE ApiConstruct SHALL 指定されたヘッダー名を使用する
5. WHEN customHeaderSecretが指定される THEN THE ApiConstruct SHALL 指定されたシークレット値を使用する

### 要件6: リソース参照の公開

**ユーザーストーリー:** 開発者として、作成されたAPIとLambdaを他のコンストラクトから参照したい。CloudFrontやServerlessSpaコンストラクトから利用するために必要である。

#### 受け入れ基準

1. THE ApiConstruct SHALL apiプロパティとしてIRestApi型のAPI参照を公開する
2. THE ApiConstruct SHALL handlerプロパティとしてIFunction型のLambda参照を公開する
3. THE ApiConstruct SHALL apiUrlプロパティとしてAPIのエンドポイントURLを公開する
4. THE ApiConstruct SHALL customHeaderNameプロパティとしてカスタムヘッダー名を公開する
5. THE ApiConstruct SHALL customHeaderSecretプロパティとしてカスタムヘッダーのシークレット値を公開する

### 要件7: 削除ポリシー

**ユーザーストーリー:** 開発者として、スタックレベルで削除ポリシーを一括管理したい。

#### 受け入れ基準

1. THE ApiConstruct SHALL 削除ポリシーを明示的に設定しない（スタックレベルで一括管理）
2. THE RestApi SHALL CDKのデフォルト動作に従う（スタックの設定を継承）
3. THE Lambda SHALL CDKのデフォルト動作に従う（スタックの設定を継承）
