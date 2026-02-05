# コーディング規約

## コード品質チェック

ファイルを修正・作成したら、必ず以下のコマンドを実行すること：

```bash
# 1. Prettierでフォーマット
npm run format

# 2. ESLintでリントチェック
npm run lint
```

エラーがある場合は修正してから次の作業に進むこと。

## 言語設定

- Spec・設計ドキュメント: 日本語で記述
- コード・コメント: 英語で記述
- コミットメッセージ: 英語で記述

## TypeScript規約

### 基本ルール

- strict modeを有効化
- 明示的な型定義を推奨（any禁止）
- interfaceよりtypeを優先（CDKの慣習に従う場合はinterface）

### 命名規則

```typescript
// Classes: PascalCase
class ServerlessSpa extends Construct {}

// Interfaces/Types: PascalCase with Props suffix for CDK props
interface ServerlessSpaProps {}

// Variables/Functions: camelCase
const bucketName = 'my-bucket';
function createBucket() {}

// Constants: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 30;

// Private members: prefix with underscore
private _internalValue: string;
```

### ファイル構成

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

## CDK規約

### Construct ID

- ケバブケースまたはパスカルケース
- 意味のある名前を付ける

```typescript
// Good
new Bucket(this, 'StaticAssetsBucket', {});
new Function(this, 'ApiHandler', {});

// Bad
new Bucket(this, 'Bucket1', {});
```

### Props設計

```typescript
// Required props first, then optional
export interface MyConstructProps {
  // Required
  readonly tableName: string;

  // Optional with defaults
  readonly timeout?: Duration;
  readonly memorySize?: number;
}
```

### リソース参照の公開

```typescript
export class MyConstruct extends Construct {
  // Expose created resources as readonly
  public readonly bucket: IBucket;
  public readonly table: ITable;

  constructor(scope: Construct, id: string, props: MyConstructProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'Bucket', {});
    this.table = new Table(this, 'Table', {});
  }
}
```

## コメント規約

```typescript
/**
 * High-level construct for deploying a serverless SPA.
 *
 * This construct creates all necessary resources including:
 * - CloudFront distribution
 * - S3 bucket for static hosting
 * - API Gateway with Lambda backend
 * - Cognito User Pool for authentication
 * - DynamoDB table for data storage
 */
export class ServerlessSpa extends Construct {
  // ...
}
```

## エラーハンドリング

- CDKのValidationを活用
- 意味のあるエラーメッセージを提供

```typescript
if (!props.domainName && props.certificate) {
  throw new Error('Certificate requires domainName to be specified');
}
```
