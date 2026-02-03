# 要件ドキュメント

## 概要

ServerlessSpaは、個人開発者向けのサーバーレスSPAインフラストラクチャを一括でデプロイする高レベルCDKコンストラクトである。DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトを統合し、最小限の設定で完全なサーバーレスSPA環境を構築する。

## 用語集

- **ServerlessSpa**: 全低レベルコンストラクトを統合する高レベルCDKコンストラクト
- **DatabaseConstruct**: DynamoDBテーブルを作成する低レベルコンストラクト
- **AuthConstruct**: Cognito User Poolを作成する低レベルコンストラクト
- **ApiConstruct**: API GatewayとLambdaを作成する低レベルコンストラクト
- **FrontendConstruct**: S3とCloudFrontを作成する低レベルコンストラクト
- **Auto-wiring**: コンストラクト間の依存関係を自動的に接続すること

## 要件

### 要件1: コンストラクト統合

**ユーザーストーリー:** 開発者として、単一のコンストラクトで完全なサーバーレスSPAインフラを構築したい。これにより、複雑な設定なしで迅速にアプリケーションをデプロイできる。

#### 受け入れ基準

1. WHEN ServerlessSpaがインスタンス化される THEN ServerlessSpaはDatabaseConstructを作成する
2. WHEN ServerlessSpaがインスタンス化される THEN ServerlessSpaはAuthConstructを作成する
3. WHEN ServerlessSpaがインスタンス化される THEN ServerlessSpaはApiConstructを作成する
4. WHEN ServerlessSpaがインスタンス化される THEN ServerlessSpaはFrontendConstructを作成する
5. THE ServerlessSpaは全てのPropsをオプショナルとし、デフォルト設定で動作する

### 要件2: 依存関係の自動接続（Auto-wiring）

**ユーザーストーリー:** 開発者として、コンストラクト間の依存関係を手動で設定したくない。これにより、設定ミスを防ぎ、開発効率を向上させたい。

#### 受け入れ基準

1. WHEN ServerlessSpaがインスタンス化される THEN ApiConstructにDatabaseConstructのtableが自動的に渡される
2. WHEN ServerlessSpaがインスタンス化される THEN ApiConstructにAuthConstructのuserPoolが自動的に渡される
3. WHEN ServerlessSpaがインスタンス化される THEN FrontendConstructにApiConstructのapiが自動的に渡される
4. WHEN ServerlessSpaがインスタンス化される THEN FrontendConstructにApiConstructのcustomHeaderNameが自動的に渡される
5. WHEN ServerlessSpaがインスタンス化される THEN FrontendConstructにApiConstructのcustomHeaderSecretが自動的に渡される

### 要件3: Props透過的転送

**ユーザーストーリー:** 開発者として、低レベルコンストラクトの設定をカスタマイズしたい。これにより、特定の要件に合わせてインフラを調整できる。

#### 受け入れ基準

1. WHEN databaseプロパティが指定される THEN ServerlessSpaはDatabaseConstructにそのPropsを透過的に渡す
2. WHEN authプロパティが指定される THEN ServerlessSpaはAuthConstructにそのPropsを透過的に渡す
3. WHEN apiプロパティが指定される THEN ServerlessSpaはApiConstructにそのPropsを透過的に渡す（tableとuserPoolを除く）
4. WHEN frontendプロパティが指定される THEN ServerlessSpaはFrontendConstructにそのPropsを透過的に渡す（api、customHeaderName、customHeaderSecretを除く）

### 要件4: リソース参照の公開

**ユーザーストーリー:** 開発者として、作成されたリソースにアクセスしたい。これにより、追加のカスタマイズや他のスタックとの連携が可能になる。

#### 受け入れ基準

1. THE ServerlessSpaはdatabaseプロパティとしてDatabaseConstructインスタンスを公開する
2. THE ServerlessSpaはauthプロパティとしてAuthConstructインスタンスを公開する
3. THE ServerlessSpaはapiプロパティとしてApiConstructインスタンスを公開する
4. THE ServerlessSpaはfrontendプロパティとしてFrontendConstructインスタンスを公開する

### 要件5: 便利プロパティの公開

**ユーザーストーリー:** 開発者として、よく使うリソース情報に簡単にアクセスしたい。これにより、ネストしたプロパティへのアクセスを簡略化できる。

#### 受け入れ基準

1. THE ServerlessSpaはdistributionDomainNameプロパティとしてCloudFrontのドメイン名を公開する
2. THE ServerlessSpaはapiUrlプロパティとしてAPI GatewayのURLを公開する
3. THE ServerlessSpaはuserPoolIdプロパティとしてCognito User Pool IDを公開する
4. THE ServerlessSpaはuserPoolClientIdプロパティとしてCognito User Pool Client IDを公開する
5. THE ServerlessSpaはtableNameプロパティとしてDynamoDBテーブル名を公開する

### 要件6: デフォルト設定

**ユーザーストーリー:** 開発者として、設定なしでベストプラクティスに従ったインフラを構築したい。これにより、セキュアでコスト最適化された環境を簡単に作成できる。

#### 受け入れ基準

1. WHEN Propsが指定されない THEN ServerlessSpaはデフォルト設定で全コンストラクトを作成する
2. WHEN Propsが指定されない THEN 作成されるインフラはセキュリティベストプラクティスに従う
3. WHEN Propsが指定されない THEN 作成されるインフラはコスト最適化された設定を使用する

### 要件7: RemovalPolicyの一括適用

**ユーザーストーリー:** 開発者として、全リソースのRemovalPolicyを一括で設定したい。これにより、開発環境と本番環境で異なる削除ポリシーを簡単に適用できる。

#### 受け入れ基準

1. WHEN removalPolicyプロパティが指定される THEN ServerlessSpaは全ての子リソースにそのRemovalPolicyを適用する
2. WHEN removalPolicyプロパティが指定されない THEN ServerlessSpaはRemovalPolicy.DESTROYをデフォルトとして使用する
3. WHEN removalPolicyがDESTROYの場合 THEN S3バケットのautoDeleteObjectsはtrueに設定される
4. WHEN removalPolicyがRETAINまたはSNAPSHOTの場合 THEN S3バケットのautoDeleteObjectsはfalseに設定される

### 要件8: タグの一括適用

**ユーザーストーリー:** 開発者として、全リソースにタグを一括で適用したい。これにより、コスト管理やリソース識別を容易にしたい。

#### 受け入れ基準

1. WHEN tagsプロパティが指定される THEN ServerlessSpaは全ての子リソースにそのタグを適用する
2. THE tagsプロパティはキーと値のペアのオブジェクトとして受け入れる
3. WHEN 複数のタグが指定される THEN 全てのタグが全ての子リソースに適用される
