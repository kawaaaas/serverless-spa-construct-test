# 要件ドキュメント

## 概要

ServerlessSpaSecurityConstructは、CloudFront用のWAF WebACLとSecrets Managerによるカスタムヘッダーローテーションを提供するus-east-1専用のL3コンストラクトである。クロスリージョンデプロイメントをサポートし、SSM Parameter Store経由でメインリージョン（ap-northeast-1等）のServerlessSpaと連携する。

## 用語集

- **ServerlessSpaSecurityConstruct**: WAFとSecrets Managerを統合するus-east-1専用のL3コンストラクト
- **WAF_WebACL**: CloudFront用のWeb Application Firewall（SCOPE: CLOUDFRONT）
- **Custom_Header_Secret**: API Gateway制限用のカスタムヘッダー値を管理するSecrets Managerシークレット
- **Rotation_Lambda**: カスタムヘッダー値を定期的にローテーションするLambda関数
- **SSM_Parameter**: クロスリージョンで値を共有するためのSSM Parameter Store
- **AwsCustomResource**: クロスリージョンでSSMパラメータを取得するためのカスタムリソース
- **ServerlessSpa**: 既存の高レベルCDKコンストラクト（メインリージョンにデプロイ）

## 要件

### 要件1: WAF WebACL作成

**ユーザーストーリー:** 開発者として、CloudFront用のWAF WebACLを作成したい。これにより、一般的なWeb攻撃からアプリケーションを保護できる。

#### 受け入れ基準

1. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはSCOPE: CLOUDFRONTのWAF WebACLを作成する
2. WHEN WAF WebACLが作成される THEN レート制限ルール（デフォルト: 2000リクエスト/5分）が含まれる
3. WHEN WAF WebACLが作成される THEN AWSマネージドルール（AWSManagedRulesCommonRuleSet）が含まれる
4. WHEN WAF WebACLが作成される THEN SQLインジェクション対策ルール（AWSManagedRulesSQLiRuleSet）が含まれる
5. WHERE rateLimitプロパティが指定される THEN ServerlessSpaSecurityConstructはそのレート制限値を使用する
6. THE ServerlessSpaSecurityConstructはwebAclArnプロパティとしてWAF WebACL ARNを公開する

### 要件2: Secrets Manager作成

**ユーザーストーリー:** 開発者として、カスタムヘッダー値をSecrets Managerで安全に管理したい。これにより、セキュリティを強化しつつ、ヘッダー値の自動ローテーションが可能になる。

#### 受け入れ基準

1. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはカスタムヘッダー値を格納するSecrets Managerシークレットを作成する
2. WHEN シークレットが作成される THEN 初期値としてランダムなUUIDが生成される
3. THE ServerlessSpaSecurityConstructはsecretArnプロパティとしてシークレットARNを公開する
4. THE ServerlessSpaSecurityConstructはcustomHeaderNameプロパティとしてカスタムヘッダー名を公開する

### 要件3: シークレットローテーション

**ユーザーストーリー:** 開発者として、カスタムヘッダー値を定期的に自動ローテーションしたい。これにより、セキュリティを継続的に維持できる。

#### 受け入れ基準

1. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはローテーション用Lambda関数を作成する
2. WHEN ローテーションLambdaが実行される THEN 新しいランダムなUUID値が生成される
3. WHEN ローテーションLambdaが実行される THEN SSM Parameterの値も同時に更新される
4. WHERE rotationDaysプロパティが指定される THEN ServerlessSpaSecurityConstructはそのローテーション間隔を使用する
5. WHEN rotationDaysプロパティが指定されない THEN ServerlessSpaSecurityConstructはデフォルトで7日間隔を使用する

### 要件4: SSM Parameter Store書き込み

**ユーザーストーリー:** 開発者として、セキュリティ設定値をSSM Parameter Storeに書き込みたい。これにより、他リージョンのスタックからこれらの値を参照できる。

#### 受け入れ基準

1. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはWAF WebACL ARNをSSM Parameterに書き込む
2. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはカスタムヘッダー名をSSM Parameterに書き込む
3. WHEN ServerlessSpaSecurityConstructがインスタンス化される THEN ServerlessSpaSecurityConstructはシークレットARNをSSM Parameterに書き込む
4. WHERE ssmPrefixプロパティが指定される THEN ServerlessSpaSecurityConstructはそのプレフィックスを使用する
5. WHEN ssmPrefixプロパティが指定されない THEN ServerlessSpaSecurityConstructはデフォルトで'/myapp/security/'を使用する
6. THE SSM Parameterのパスは{ssmPrefix}waf-acl-arn、{ssmPrefix}custom-header-name、{ssmPrefix}secret-arnの形式とする

### 要件5: クロスリージョンSSM取得（ServerlessSpa拡張）

**ユーザーストーリー:** 開発者として、メインリージョンのServerlessSpaからus-east-1のSSMパラメータを取得したい。これにより、クロスリージョンでセキュリティ設定を共有できる。

#### 受け入れ基準

1. WHEN ServerlessSpaにsecurityプロパティが指定される THEN ServerlessSpaはAwsCustomResourceを使用してus-east-1のSSMパラメータを取得する
2. WHEN SSMパラメータが取得される THEN ServerlessSpaはWAF WebACL ARNをCloudFrontに適用する
3. WHEN SSMパラメータが取得される THEN ServerlessSpaはカスタムヘッダー名とシークレットARNをApiConstructに渡す
4. THE AwsCustomResourceはus-east-1リージョンを明示的に指定してSSM GetParameterを呼び出す

### 要件6: CloudFront WAF適用

**ユーザーストーリー:** 開発者として、CloudFrontディストリビューションにWAF WebACLを適用したい。これにより、エッジレベルでの攻撃防御が可能になる。

#### 受け入れ基準

1. WHEN securityプロパティが指定される THEN FrontendConstructのCloudFrontディストリビューションにWAF WebACLが適用される
2. WHEN securityプロパティが指定されない THEN CloudFrontディストリビューションにWAFは適用されない

### 要件7: API Gatewayカスタムヘッダー検証

**ユーザーストーリー:** 開発者として、API GatewayでSecrets Managerのカスタムヘッダー値を検証したい。これにより、CloudFront経由のリクエストのみを許可できる。

#### 受け入れ基準

1. WHEN securityプロパティが指定される THEN ApiConstructはSecrets Managerからカスタムヘッダー値を取得する
2. WHEN securityプロパティが指定される THEN API Gatewayのリソースポリシーはそのカスタムヘッダー値で検証する
3. IF カスタムヘッダー値が一致しない THEN API Gatewayはリクエストを拒否する

### 要件8: デプロイメントパターン

**ユーザーストーリー:** 開発者として、2つのスタックを順番にデプロイしてセキュリティ機能を有効化したい。これにより、クロスリージョンの依存関係を正しく管理できる。

#### 受け入れ基準

1. THE SecurityStackはus-east-1リージョンにデプロイされる
2. THE AppStack（ServerlessSpa）はメインリージョン（例: ap-northeast-1）にデプロイされる
3. WHEN AppStackがデプロイされる THEN SecurityStackが先にデプロイされている必要がある
4. THE ServerlessSpaSecurityConstructはus-east-1以外のリージョンでインスタンス化された場合にエラーを発生させる
