# コンストラクト設計

## 設計方針

将来のnpm公開を見据え、高レベルAPIと低レベルAPIの2層構造で設計する。
ユーザーは用途に応じて適切なレベルのAPIを選択できる。
各コンストラクトはPropsで柔軟にカスタマイズ可能とする。

## コンストラクト階層

```
ServerlessSpa (高レベル)
├── FrontendConstruct (低レベル)
│   ├── S3 Bucket
│   └── CloudFront Distribution
├── AuthConstruct (低レベル)
│   └── Cognito User Pool
├── ApiConstruct (低レベル)
│   ├── API Gateway (REST)
│   └── Lambda Function
└── DatabaseConstruct (低レベル)
    └── DynamoDB Table
```

## ファイル構成

```
lib/
├── constructs/
│   ├── serverless-spa.ts      # High-level construct
│   ├── frontend-construct.ts  # Low-level: S3 + CloudFront
│   ├── auth-construct.ts      # Low-level: Cognito
│   ├── api-construct.ts       # Low-level: API Gateway + Lambda
│   └── database-construct.ts  # Low-level: DynamoDB
├── lambda/
│   └── handler.ts             # Lambda handler
└── index.ts                   # Public exports
```

## 高レベルAPI: ServerlessSpa

全リソースを一括でデプロイする。最小限の設定で動作する。
低レベルコンストラクトのPropsを透過的に渡せる。

```typescript
new ServerlessSpa(this, 'MyApp', {
  // Optional: pass through to low-level constructs
  auth?: AuthConstructProps;
  api?: ApiConstructProps;
  database?: DatabaseConstructProps;
  frontend?: FrontendConstructProps;
});
```

## 低レベルAPI

### FrontendConstruct

S3 + CloudFrontの静的ホスティング。

```typescript
interface FrontendConstructProps {
  // Optional customizations
  readonly bucketProps?: Partial<BucketProps>;
  readonly distributionProps?: Partial<DistributionProps>;
}
```

### AuthConstruct

Cognito User Poolの認証基盤。

```typescript
interface AuthConstructProps {
  // Optional customizations
  readonly userPoolProps?: Partial<UserPoolProps>;
  readonly userPoolClientProps?: Partial<UserPoolClientProps>;
}
```

### ApiConstruct

API Gateway + Lambdaのバックエンド。

```typescript
interface ApiConstructProps {
  // Required: DynamoDB table for Lambda
  readonly table: ITable;
  
  // Optional customizations
  readonly lambdaProps?: Partial<NodejsFunctionProps>;
  readonly restApiProps?: Partial<RestApiProps>;
}
```

### DatabaseConstruct

DynamoDBテーブル。シングルテーブル設計をデフォルトとするが、カスタマイズ可能。

```typescript
interface DatabaseConstructProps {
  // Optional customizations
  readonly tableName?: string;
  readonly partitionKey?: Attribute;
  readonly sortKey?: Attribute;
  readonly globalSecondaryIndexes?: GlobalSecondaryIndexProps[];
  readonly tableProps?: Partial<TableProps>;
}
```

## Props設計方針

- 必須プロパティは最小限に（依存関係のみ）
- オプショナルプロパティでカスタマイズ可能に
- デフォルト値は最安構成・ベストプラクティスに従う
- 低レベルコンストラクトのPropsを高レベルでも受け入れ可能に
- `Partial<XxxProps>` パターンで既存CDK Propsを拡張可能に

## 出力（Outputs）

各コンストラクトは以下を公開する：

- 作成したリソースへの参照（readonly）
- 他コンストラクトとの連携に必要な情報
- CloudFormation Outputsとしてエクスポートする値

```typescript
// Example: DatabaseConstruct outputs
export class DatabaseConstruct extends Construct {
  public readonly table: ITable;
  public readonly tableName: string;
  public readonly tableArn: string;
}
```

## 拡張性

- 低レベルコンストラクトは単独でも使用可能
- 高レベルコンストラクトは低レベルを組み合わせて構築
- 将来的な機能追加（WAF、カスタムドメイン等）に対応できる構造
- 外部で作成したリソースを注入可能（ITable, IUserPool等のインターフェース型）
