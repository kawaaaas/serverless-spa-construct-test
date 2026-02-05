# 要件定義書

## 概要

CloudFront → API Gateway間のセキュリティを強化するため、Secrets Managerのマルチリージョンレプリケーションを使用したカスタムヘッダー検証機能を実装する。Lambda@EdgeがCloudFrontのOrigin Requestでシークレット値をカスタムヘッダーとして付与し、Lambda AuthorizerがAPI Gateway側でそのヘッダーを検証することで、CloudFront経由以外のアクセスを確実に拒否する。

## 用語集

- **Secret_Construct**: Secrets Managerシークレットとそのレプリケーションを管理するCDKコンストラクト
- **Lambda_Edge_Construct**: CloudFrontのOrigin Requestでカスタムヘッダーを付与するLambda@Edgeを管理するCDKコンストラクト
- **Lambda_Authorizer**: API Gatewayのリクエストを検証するLambda関数
- **Api_Construct**: API GatewayとLambdaバックエンドを管理するCDKコンストラクト
- **Frontend_Construct**: S3とCloudFrontを管理するCDKコンストラクト
- **Custom_Header**: CloudFrontからAPI Gatewayへのリクエストに付与される検証用ヘッダー
- **Secret_Value**: Secrets Managerに保存されるカスタムヘッダーの値
- **Primary_Region**: シークレットのプライマリリージョン（us-east-1）
- **Replica_Region**: シークレットのレプリカリージョン（デフォルト: ap-northeast-1）
- **Cache_TTL**: Lambda関数がシークレット値をメモリにキャッシュする時間

## 要件

### 要件 1: シークレットのマルチリージョンレプリケーション

**ユーザーストーリー:** インフラ管理者として、シークレットを複数リージョンで利用可能にしたい。これにより、Lambda@Edge（us-east-1）とLambda Authorizer（アプリケーションリージョン）の両方が同じシークレット値にアクセスできる。

#### 受け入れ基準

1. WHEN Secret_Constructが作成される THEN Secret_ConstructはプライマリリージョンにSecrets Managerシークレットを作成するものとする
2. WHEN Secret_Constructが作成される THEN Secret_Constructは指定されたレプリカリージョンへのレプリケーションを設定するものとする
3. WHEN レプリカリージョンが指定されない THEN Secret_Constructはデフォルトでap-northeast-1にレプリケートするものとする
4. WHEN シークレットがローテーションされる THEN Secret_Constructはレプリカリージョンにも自動的に同期されることを保証するものとする
5. WHEN Secret_Constructが削除される THEN Secret_Constructはレプリカも含めて削除するものとする

### 要件 2: Lambda@Edgeによるカスタムヘッダー付与

**ユーザーストーリー:** セキュリティエンジニアとして、CloudFrontからAPI Gatewayへのリクエストにシークレット値を含むカスタムヘッダーを付与したい。これにより、API GatewayがCloudFront経由のリクエストを識別できる。

#### 受け入れ基準

1. WHEN Lambda_Edge_Constructが作成される THEN Lambda_Edge_Constructはus-east-1リージョンにLambda@Edge関数を作成するものとする
2. WHEN CloudFrontがOrigin Requestを処理する THEN Lambda@EdgeはSecrets Managerからシークレット値を取得するものとする
3. WHEN シークレット値が取得される THEN Lambda@Edgeはリクエストにカスタムヘッダーを付与するものとする
4. WHEN シークレット値がキャッシュされている THEN Lambda@EdgeはSecrets Managerへのリクエストをスキップするものとする
5. WHEN キャッシュが期限切れになる THEN Lambda@Edgeは新しいシークレット値を取得するものとする
6. IF Secrets Managerへのアクセスが失敗する THEN Lambda@Edgeはエラーをログに記録しリクエストを拒否するものとする

### 要件 3: Lambda Authorizerによるカスタムヘッダー検証

**ユーザーストーリー:** セキュリティエンジニアとして、API Gatewayへのリクエストがカスタムヘッダーを含み、その値が正しいことを検証したい。これにより、CloudFront経由以外のアクセスを拒否できる。

#### 受け入れ基準

1. WHEN Api_ConstructにLambda Authorizerが設定される THEN Api_ConstructはAPI GatewayにLambda Authorizerを追加するものとする
2. WHEN リクエストがAPI Gatewayに到達する THEN Lambda Authorizerはカスタムヘッダーの存在を検証するものとする
3. WHEN カスタムヘッダーが存在する THEN Lambda Authorizerはローカルリージョンのシークレットレプリカから値を取得し検証するものとする
4. WHEN カスタムヘッダーの値が正しい THEN Lambda Authorizerはリクエストを許可するものとする
5. IF カスタムヘッダーが存在しない THEN Lambda Authorizerはリクエストを拒否するものとする
6. IF カスタムヘッダーの値が不正 THEN Lambda Authorizerはリクエストを拒否するものとする
7. WHEN シークレット値がキャッシュされている THEN Lambda AuthorizerはSecrets Managerへのリクエストをスキップするものとする

### 要件 4: Api_Constructの改修

**ユーザーストーリー:** 開発者として、Api_ConstructがLambda Authorizerを使用してカスタムヘッダー検証を行い、リソースポリシーと併用することで多層防御を実現したい。

#### 受け入れ基準

1. WHEN Api_ConstructにsecretArnが提供される THEN Api_ConstructはLambda Authorizerを作成するものとする
2. WHEN Lambda Authorizerが作成される THEN Api_ConstructはCognito Authorizerと併用するものとする
3. WHEN Api_Constructが作成される THEN Api_Constructはリソースポリシーを維持するものとする
4. WHEN Lambda Authorizerが設定される THEN Api_ConstructはLambda Authorizerにシークレット読み取り権限を付与するものとする
5. WHEN リソースポリシーとLambda Authorizerの両方が設定される THEN Api_Constructは多層防御を提供するものとする

### 要件 5: Frontend_Constructの改修

**ユーザーストーリー:** 開発者として、Frontend_ConstructがLambda@Edgeを使用してカスタムヘッダーを付与するようにしたい。これにより、静的なカスタムヘッダー設定を動的なシークレット値に置き換えられる。

#### 受け入れ基準

1. WHEN Frontend_ConstructにLambda@Edge関数が提供される THEN Frontend_ConstructはCloudFrontのOrigin RequestにLambda@Edgeを関連付けるものとする
2. WHEN Lambda@Edgeが設定される THEN Frontend_Constructは静的なカスタムヘッダー設定を削除するものとする
3. WHEN Frontend_ConstructにLambda@Edgeが提供されない THEN Frontend_Constructは従来の静的カスタムヘッダー設定を使用するものとする

### 要件 6: 統合とセキュリティ

**ユーザーストーリー:** インフラ管理者として、すべてのコンポーネントが正しく統合され、CloudFront経由以外のAPI Gatewayアクセスが確実に拒否されることを確認したい。

#### 受け入れ基準

1. WHEN ServerlessSpaSecurityConstructが作成される THEN ServerlessSpaSecurityConstructはSecret_Constructをレプリケーション設定付きで作成するものとする
2. WHEN ServerlessSpaSecurityConstructが作成される THEN ServerlessSpaSecurityConstructはLambda@Edge関数を作成するものとする
3. WHEN ServerlessSpaが作成される THEN ServerlessSpaはLambda@EdgeをFrontend_Constructに渡すものとする
4. WHEN ServerlessSpaが作成される THEN ServerlessSpaはsecretArnをApi_Constructに渡すものとする
5. WHEN CloudFront経由でないリクエストがAPI Gatewayに到達する THEN Lambda Authorizerはリクエストを拒否するものとする
6. WHEN CloudFront経由のリクエストがAPI Gatewayに到達する THEN Lambda Authorizerはリクエストを許可するものとする

### 要件 7: キャッシュとパフォーマンス

**ユーザーストーリー:** 開発者として、Lambda関数がシークレット値をキャッシュすることで、Secrets Managerへのリクエスト数を削減しレイテンシを最小化したい。

#### 受け入れ基準

1. WHEN Lambda@Edgeがシークレット値を取得する THEN Lambda@Edgeは値をメモリにキャッシュするものとする
2. WHEN Lambda Authorizerがシークレット値を取得する THEN Lambda Authorizerは値をメモリにキャッシュするものとする
3. WHEN キャッシュTTLが設定可能である THEN Lambda関数はデフォルトで5分のTTLを使用するものとする
4. WHEN キャッシュが有効な間 THEN Lambda関数はSecrets Managerへのリクエストを行わないものとする
