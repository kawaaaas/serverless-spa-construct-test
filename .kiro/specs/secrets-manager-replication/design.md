# 設計書

## 概要

本設計書は、CloudFront → API Gateway間のセキュリティを強化するため、Secrets Managerのマルチリージョンレプリケーションを使用したカスタムヘッダー検証機能の実装について記述する。

### 主要な変更点

1. **SecretConstruct**: レプリケーション機能の追加
2. **Lambda@Edge**: Origin Requestでカスタムヘッダーを動的に付与
3. **Lambda Authorizer**: API Gatewayでカスタムヘッダーを検証
4. **ApiConstruct**: Lambda Authorizerの追加（Cognito Authorizerと併用）
5. **FrontendConstruct**: Lambda@Edgeの統合

## アーキテクチャ

### リージョン配置

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ us-east-1 (ServerlessSpaSecurityConstruct)                                  │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ WAF WebACL      │    │ Secrets Manager │    │ Lambda@Edge     │         │
│  │ (CLOUDFRONT)    │    │ (プライマリ)     │    │ (Origin Request)│         │
│  └────────┬────────┘    └────────┬────────┘    │ ヘッダー付与     │         │
│           │                      │             └─────────────────┘         │
│           │                      │ レプリケート                             │
│           │                      ▼                                         │
└───────────┼──────────────────────┼─────────────────────────────────────────┘
            │                      │
            │                      │
┌───────────┼──────────────────────┼─────────────────────────────────────────┐
│ ap-northeast-1 (ServerlessSpa)   │                                         │
│           │                      ▼                                         │
│           │             ┌─────────────────┐                                │
│           │             │ Secrets Manager │                                │
│           │             │ (レプリカ)      │                                │
│           │             └────────┬────────┘                                │
│           │                      │                                         │
│           ▼                      ▼                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ CloudFront      │───▶│ API Gateway     │───▶│ Lambda          │         │
│  │ + WAF           │    │ + Cognito Auth  │    │ (Backend)       │         │
│  │ + Lambda@Edge   │    │ + Lambda Auth   │    └─────────────────┘         │
│  └─────────────────┘    └─────────────────┘                                │
│                                  │                                         │
│                                  ▼                                         │
│                         ┌─────────────────┐                                │
│                         │ Lambda          │                                │
│                         │ Authorizer      │                                │
│                         │ ヘッダー検証     │                                │
│                         └─────────────────┘                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### リソース配置表

| リソース                  | リージョン     | 所属コンストラクト             | 備考                         |
| ------------------------- | -------------- | ------------------------------ | ---------------------------- |
| WAF WebACL                | us-east-1      | ServerlessSpaSecurityConstruct | CLOUDFRONT scope必須         |
| Secrets Manager (Primary) | us-east-1      | ServerlessSpaSecurityConstruct | プライマリシークレット       |
| Lambda@Edge               | us-east-1      | ServerlessSpaSecurityConstruct | CloudFront関連付け用         |
| SSM Parameters            | us-east-1      | ServerlessSpaSecurityConstruct | クロスリージョン参照用       |
| Secrets Manager (Replica) | ap-northeast-1 | 自動レプリケート               | Lambda Authorizer用          |
| CloudFront                | グローバル     | ServerlessSpa (Frontend)       | ap-northeast-1スタックで定義 |
| API Gateway               | ap-northeast-1 | ServerlessSpa (Api)            | REST API                     |
| Lambda Authorizer         | ap-northeast-1 | ServerlessSpa (Api)            | カスタムヘッダー検証         |
| Lambda (Backend)          | ap-northeast-1 | ServerlessSpa (Api)            | バックエンド処理             |
| Cognito User Pool         | ap-northeast-1 | ServerlessSpa (Auth)           | JWT認証                      |
| DynamoDB                  | ap-northeast-1 | ServerlessSpa (Database)       | データストア                 |
| S3 Bucket                 | ap-northeast-1 | ServerlessSpa (Frontend)       | 静的ファイル                 |

## コンポーネントとインターフェース

### リージョン別コンストラクト構成

#### us-east-1 (ServerlessSpaSecurityConstruct)

```
ServerlessSpaSecurityConstruct
├── WafConstruct (既存)
│   └── WAF WebACL (CLOUDFRONT scope)
├── SecretConstruct (改修)
│   ├── Secrets Manager (Primary)
│   └── Rotation Lambda
├── LambdaEdgeConstruct (新規)
│   └── Lambda@Edge Function
└── SsmConstruct (既存)
    └── SSM Parameters
```

#### ap-northeast-1 (ServerlessSpa)

```
ServerlessSpa
├── FrontendConstruct (改修)
│   ├── S3 Bucket
│   ├── CloudFront Distribution
│   │   ├── WAF WebACL (us-east-1から参照)
│   │   └── Lambda@Edge (us-east-1から参照)
│   └── Route53 Record (optional)
├── ApiConstruct (改修)
│   ├── API Gateway (REST)
│   ├── Lambda (Backend)
│   ├── Lambda Authorizer (新規) ← Secrets Manager Replicaを参照
│   └── Cognito Authorizer
├── AuthConstruct (既存)
│   └── Cognito User Pool
└── DatabaseConstruct (既存)
    └── DynamoDB Table
```

### 1. SecretConstruct（改修）- us-east-1

#### 変更内容

- `replicaRegions`プロパティを追加してマルチリージョンレプリケーションを設定

#### インターフェース

```typescript
export interface SecretConstructProps {
  /**
   * Custom header name for API Gateway access restriction.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Secret rotation interval in days.
   * @default 7
   */
  readonly rotationDays?: number;

  /**
   * SSM Parameter Store prefix for updating during rotation.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * Regions to replicate the secret to.
   * @default ['ap-northeast-1']
   */
  readonly replicaRegions?: string[];

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

#### 出力

- `secret: ISecret` - Secrets Managerシークレット
- `secretArn: string` - シークレットARN
- `customHeaderName: string` - カスタムヘッダー名
- `replicaRegions: string[]` - レプリカリージョン

### 2. LambdaEdgeConstruct（新規）- us-east-1

#### 責務

- Lambda@Edge関数の作成（us-east-1必須）
- Secrets Managerからシークレット値を取得（us-east-1のプライマリ）
- Origin Requestにカスタムヘッダーを付与

#### 重要な制約

- **必ずus-east-1にデプロイ**（CloudFront Lambda@Edgeの要件）
- ServerlessSpaSecurityConstructの一部として作成
- 関数バージョンARNをServerlessSpaに渡す

#### インターフェース

```typescript
export interface LambdaEdgeConstructProps {
  /**
   * The Secrets Manager secret ARN.
   * Must be in us-east-1 region.
   */
  readonly secretArn: string;

  /**
   * Custom header name to add to requests.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Cache TTL for secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly cacheTtlSeconds?: number;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

#### 出力

- `edgeFunction: cloudfront.experimental.EdgeFunction` - Lambda@Edge関数
- `functionVersion: lambda.IVersion` - 関数バージョン

### 3. Lambda Authorizer Handler（新規）- ap-northeast-1

#### 責務

- カスタムヘッダーの存在確認
- **ローカルリージョン（ap-northeast-1）のSecrets Managerレプリカ**からシークレット値を取得
- ヘッダー値の検証
- IAMポリシーの生成

#### 重要な制約

- **ap-northeast-1にデプロイ**（API Gatewayと同じリージョン）
- ApiConstructの一部として作成
- Secrets Managerレプリカを参照（レイテンシ最小化）

#### インターフェース（Lambda Event）

```typescript
interface APIGatewayRequestAuthorizerEvent {
  type: 'REQUEST';
  methodArn: string;
  headers: { [key: string]: string };
  queryStringParameters: { [key: string]: string };
  pathParameters: { [key: string]: string };
  stageVariables: { [key: string]: string };
  requestContext: APIGatewayEventRequestContext;
}

interface APIGatewayAuthorizerResult {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: 'Allow' | 'Deny';
      Resource: string;
    }>;
  };
}
```

### 4. ApiConstruct（改修）- ap-northeast-1

#### 変更内容

- Lambda Authorizerの追加（REQUEST型）
- Cognito AuthorizerとLambda Authorizerの併用
- リソースポリシーは維持（多層防御）

#### 重要な制約

- **ap-northeast-1にデプロイ**
- Lambda AuthorizerはSecrets Managerレプリカ（ap-northeast-1）を参照
- secretArnはレプリカのARNを使用（リージョン部分を置換）

#### インターフェース変更

```typescript
export interface ApiConstructProps {
  // 既存のプロパティ...
  readonly table: ITable;
  readonly userPool?: IUserPool;
  readonly customHeaderName?: string;
  readonly customHeaderSecret?: string;
  readonly secretArn?: string;
  readonly entry?: string;
  readonly lambdaProps?: Partial<NodejsFunctionProps>;
  readonly restApiProps?: Partial<RestApiProps>;

  // 新規追加
  /**
   * Enable Lambda Authorizer for custom header validation.
   * Requires secretArn to be provided.
   * @default true when secretArn is provided
   */
  readonly enableLambdaAuthorizer?: boolean;

  /**
   * Cache TTL for Lambda Authorizer secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly authorizerCacheTtlSeconds?: number;
}
```

### 5. FrontendConstruct（改修）- ap-northeast-1

#### 変更内容

- Lambda@Edge関数バージョンの統合オプション追加
- Lambda@Edge使用時は静的カスタムヘッダーを無効化

#### 重要な制約

- **ap-northeast-1スタックで定義**（CloudFront自体はグローバル）
- Lambda@Edge関数バージョンARNはus-east-1から渡される
- WAF WebACL ARNもus-east-1から渡される

#### インターフェース変更

```typescript
export interface FrontendConstructProps {
  // 既存のプロパティ...
  readonly api?: IRestApi;
  readonly webAclArn?: string;
  readonly domainName?: string;
  readonly alternativeDomainNames?: string[];
  readonly certificate?: ICertificate;
  readonly hostedZoneId?: string;
  readonly zoneName?: string;
  readonly customHeaderName?: string;
  readonly customHeaderSecret?: string;
  readonly bucketProps?: Partial<BucketProps>;
  readonly distributionProps?: Partial<DistributionProps>;

  // 新規追加
  /**
   * Lambda@Edge function version for origin request.
   * When provided, static custom header configuration is disabled.
   */
  readonly edgeFunctionVersion?: lambda.IVersion;
}
```

### 6. ServerlessSpaSecurityConstruct（改修）- us-east-1

#### 変更内容

- LambdaEdgeConstructの統合
- レプリカリージョン設定の追加
- Lambda@Edge関数バージョンARNの公開

#### 重要な制約

- **必ずus-east-1にデプロイ**
- Lambda@Edge関数バージョンARNをSSMパラメータに保存
- ServerlessSpaがクロスリージョンで参照可能に

#### インターフェース変更

```typescript
export interface ServerlessSpaSecurityConstructProps {
  // 既存のプロパティ...
  readonly waf?: WafConstructProps;
  readonly secret?: Omit<SecretConstructProps, 'ssmPrefix'>;
  readonly ssm?: Pick<SsmConstructProps, 'ssmPrefix'>;
  readonly removalPolicy?: RemovalPolicy;

  // 新規追加
  /**
   * Regions to replicate the secret to.
   * @default ['ap-northeast-1']
   */
  readonly replicaRegions?: string[];

  /**
   * Cache TTL for Lambda@Edge secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly edgeCacheTtlSeconds?: number;
}
```

## データモデル

### Secrets Managerシークレット構造

```json
{
  "headerName": "x-origin-verify",
  "headerValue": "uuid-v4-value"
}
```

### Lambda Authorizer キャッシュ構造

```typescript
interface SecretCache {
  value: string;
  expiresAt: number;
}
```

### クロスリージョン参照（SSMパラメータ）

ServerlessSpaSecurityConstruct（us-east-1）が作成するSSMパラメータ：

| パラメータ名                           | 値                           | 用途                   |
| -------------------------------------- | ---------------------------- | ---------------------- |
| `{ssmPrefix}waf-acl-arn`               | WAF WebACL ARN               | CloudFrontに関連付け   |
| `{ssmPrefix}custom-header-name`        | カスタムヘッダー名           | Lambda@Edge/Authorizer |
| `{ssmPrefix}secret-arn`                | シークレットARN (us-east-1)  | Lambda@Edge用          |
| `{ssmPrefix}edge-function-version-arn` | Lambda@Edge関数バージョンARN | CloudFrontに関連付け   |

### シークレットARNのリージョン変換

Lambda Authorizerはレプリカを参照するため、ARNのリージョン部分を変換：

```typescript
// us-east-1のシークレットARN
const primaryArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';

// ap-northeast-1のレプリカARN（同じシークレット名）
const replicaArn = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:my-secret-abc123';
```

````

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなります。_

### Property 1: Lambda@Edgeヘッダー付与

*任意の*CloudFront Origin Requestイベントとシークレット値について、Lambda@Edge関数が正常に実行された場合、出力リクエストには指定されたカスタムヘッダー名とシークレット値が含まれるものとする
**Validates: Requirements 2.3**

### Property 2: Lambda Authorizer認可判定

*任意の*API Gatewayリクエストとシークレット値について、リクエストヘッダーに正しいカスタムヘッダー値が含まれる場合はAllowポリシーが返され、ヘッダーが欠落または不正な値の場合はDenyポリシーが返されるものとする
**Validates: Requirements 3.4, 3.5, 3.6**

### Property 3: キャッシュ動作

*任意の*Lambda関数とキャッシュTTLについて、キャッシュが有効な間（現在時刻 < キャッシュ作成時刻 + TTL）はキャッシュされた値が使用され、期限切れ後は新しい値がSecrets Managerから取得されるものとする
**Validates: Requirements 2.4, 2.5, 3.7, 7.4**

### Property 4: キャッシュ設定

*任意の*Lambda関数について、シークレット値を取得した後、その値と有効期限がメモリにキャッシュされるものとする
**Validates: Requirements 7.1, 7.2**

## エラーハンドリング

### Lambda@Edge エラー処理

| エラー種別                 | 処理                                           |
| -------------------------- | ---------------------------------------------- |
| Secrets Manager接続エラー  | エラーログ出力、リクエスト拒否（403）          |
| シークレット値パースエラー | エラーログ出力、リクエスト拒否（403）          |
| タイムアウト               | CloudFrontデフォルト動作（オリジンへ転送なし） |

### Lambda Authorizer エラー処理

| エラー種別                 | 処理                              |
| -------------------------- | --------------------------------- |
| ヘッダー欠落               | Deny ポリシー返却                 |
| ヘッダー値不一致           | Deny ポリシー返却                 |
| Secrets Manager接続エラー  | エラーログ出力、Deny ポリシー返却 |
| シークレット値パースエラー | エラーログ出力、Deny ポリシー返却 |

### CDK Validation エラー

```typescript
// SecretConstruct
if (props.replicaRegions?.includes('us-east-1')) {
  throw new Error('us-east-1 cannot be specified as a replica region (it is the primary region)');
}

// LambdaEdgeConstruct
const region = Stack.of(this).region;
if (region !== 'us-east-1' && !Token.isUnresolved(region)) {
  throw new Error('LambdaEdgeConstruct must be deployed in us-east-1 region');
}

// FrontendConstruct
if (props.edgeFunctionVersion && props.customHeaderSecret) {
  console.warn('customHeaderSecret is ignored when edgeFunctionVersion is provided');
}
````

## テスト戦略

### ユニットテスト

1. **SecretConstruct テスト**
   - レプリケーション設定が正しく作成されること
   - デフォルトレプリカリージョンが設定されること
   - 無効なレプリカリージョンでエラーが発生すること

2. **LambdaEdgeConstruct テスト**
   - Lambda@Edge関数がus-east-1に作成されること
   - Secrets Manager読み取り権限が付与されること
   - 環境変数が正しく設定されること

3. **ApiConstruct テスト**
   - Lambda Authorizerが作成されること
   - Cognito AuthorizerとLambda Authorizerが併用されること
   - リソースポリシーが維持されること

4. **FrontendConstruct テスト**
   - Lambda@Edgeが正しく関連付けられること
   - Lambda@Edge使用時に静的ヘッダーが無効化されること

### プロパティベーステスト

1. **Property 3: Lambda Authorizer検証**
   - ランダムなヘッダー値を生成し、正しい値のみが許可されることを検証
   - 100回以上の反復実行

2. **Property 4: キャッシュTTL遵守**
   - ランダムなTTL値とタイムスタンプを生成し、キャッシュ動作を検証
   - 100回以上の反復実行

### 統合テスト（手動）

1. CloudFront経由でAPI Gatewayにアクセスし、正常にレスポンスが返ること
2. API Gatewayに直接アクセスし、403エラーが返ること
3. シークレットローテーション後も正常にアクセスできること
