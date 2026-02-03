# 設計ドキュメント

## 概要

ApiConstructは、API Gateway（REST）とLambda関数を作成する低レベルCDKコンストラクトである。CloudFront経由のみアクセス可能なセキュアなAPI構成を提供し、カスタムヘッダーによるアクセス制限とオプションのCognito認証をサポートする。Propsパターンにより柔軟なカスタマイズが可能で、他のコンストラクト（FrontendConstruct、ServerlessSpa等）から参照できるようAPI情報を公開する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ApiConstruct                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    REST API Gateway                              │    │
│  │                                                                  │    │
│  │  Resource Policy:                                               │    │
│  │  - Allow only requests with custom header                       │    │
│  │  - Header: x-origin-verify (configurable)                       │    │
│  │  - Secret: auto-generated or user-provided                      │    │
│  │                                                                  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │  Cognito Authorizer (Optional)                           │  │    │
│  │  │  - Created when userPool is provided                     │  │    │
│  │  │  - JWT validation                                        │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  Routes:                                                        │    │
│  │  - /{proxy+} → Lambda (ANY method)                             │    │
│  │  - / → Lambda (ANY method)                                     │    │
│  │                                                                  │    │
│  │  CORS: Enabled (default)                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                           │                                              │
│                           │ Proxy Integration                            │
│                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Lambda Function                               │    │
│  │                                                                  │    │
│  │  Runtime: Node.js 20.x                                          │    │
│  │  Memory: 128 MB (default)                                       │    │
│  │  Timeout: 30 seconds (default)                                  │    │
│  │                                                                  │    │
│  │  Environment Variables:                                         │    │
│  │  - TABLE_NAME: DynamoDB table name                              │    │
│  │                                                                  │    │
│  │  Permissions:                                                   │    │
│  │  - DynamoDB: Read/Write                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                           │                                              │
│                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    DynamoDB Table (External)                     │    │
│  │                    Provided via props.table                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Outputs:                                                                │
│  - api: IRestApi                                                         │
│  - handler: IFunction                                                    │
│  - apiUrl: string                                                        │
│  - customHeaderName: string                                              │
│  - customHeaderSecret: string                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## コンポーネントとインターフェース

### ApiConstructProps

```typescript
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RestApiProps } from 'aws-cdk-lib/aws-apigateway';

export interface ApiConstructProps {
  /**
   * The DynamoDB table for Lambda to access.
   * Required - Lambda will have read/write permissions to this table.
   */
  readonly table: ITable;

  /**
   * Optional Cognito User Pool for JWT authentication.
   * If provided, a Cognito Authorizer will be created and applied to all endpoints.
   */
  readonly userPool?: IUserPool;

  /**
   * Custom header name for CloudFront-only access restriction.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Custom header secret value for CloudFront-only access restriction.
   * If not provided, a random UUID will be generated.
   */
  readonly customHeaderSecret?: string;

  /**
   * Additional Lambda function properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly lambdaProps?: Partial<NodejsFunctionProps>;

  /**
   * Additional REST API properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly restApiProps?: Partial<RestApiProps>;
}
```

### ApiConstruct クラス

```typescript
import { Construct } from 'constructs';
import { IRestApi, RestApi, CognitoUserPoolsAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ApiConstruct extends Construct {
  /**
   * The REST API created by this construct.
   */
  public readonly api: IRestApi;

  /**
   * The Lambda function created by this construct.
   */
  public readonly handler: IFunction;

  /**
   * The URL of the REST API endpoint.
   */
  public readonly apiUrl: string;

  /**
   * The custom header name used for CloudFront-only access restriction.
   */
  public readonly customHeaderName: string;

  /**
   * The custom header secret value used for CloudFront-only access restriction.
   */
  public readonly customHeaderSecret: string;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

## データモデル

### デフォルト設定値

#### Lambda関数

| 設定項目   | デフォルト値  | 理由                              |
| ---------- | ------------- | --------------------------------- |
| runtime    | Node.js 20.x  | 最新のLTSバージョン               |
| memorySize | 128 MB        | コスト最適化（最小構成）          |
| timeout    | 30秒          | API Gateway統合の最大タイムアウト |
| handler    | index.handler | 標準的なエントリーポイント        |

#### REST API

| 設定項目                    | デフォルト値   | 理由                   |
| --------------------------- | -------------- | ---------------------- |
| deployOptions.stageName     | 'prod'         | 本番環境向けデフォルト |
| defaultCorsPreflightOptions | 全オリジン許可 | 開発時の利便性         |

#### カスタムヘッダー

| 設定項目           | デフォルト値      | 理由                           |
| ------------------ | ----------------- | ------------------------------ |
| customHeaderName   | 'x-origin-verify' | CloudFront検証用の標準的な名前 |
| customHeaderSecret | UUID v4           | セキュアなランダム値           |

### リソースポリシー構造

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*/*/*/*",
      "Condition": {
        "StringNotEquals": {
          "aws:Referer": "${customHeaderSecret}"
        }
      }
    },
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*/*/*/*"
    }
  ]
}
```

### Lambda環境変数

| 変数名     | 値                    | 説明               |
| ---------- | --------------------- | ------------------ |
| TABLE_NAME | props.table.tableName | DynamoDBテーブル名 |

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: restApiProps上書き

_任意の_ restApiProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。例えば、descriptionやdeployOptionsなどのプロパティが指定された値で設定される。

**検証対象: 要件 1.5**

### プロパティ2: lambdaProps上書き

_任意の_ lambdaProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。例えば、memorySize、timeout、environmentなどのプロパティが指定された値で設定される。

**検証対象: 要件 2.7**

## エラーハンドリング

### バリデーション

ApiConstructは以下のバリデーションを行う：

1. **tableの必須チェック**: propsにtableが指定されていることを確認（TypeScriptの型システムで強制）
2. **userPoolの型チェック**: 指定された場合、IUserPool型であることを確認

### エラーメッセージ

CDKの標準的なバリデーションエラーメッセージを使用する。カスタムバリデーションは最小限に抑え、CDKの既存機能を活用する。

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

### テストケース

1. **REST API作成テスト**
   - REST APIリソースが作成されること
   - リソースポリシーが設定されること
   - CORSが有効であること

2. **Lambda関数作成テスト**
   - Lambda関数リソースが作成されること
   - Node.js 20.xランタイムが設定されること
   - デフォルトメモリ（128MB）が設定されること
   - デフォルトタイムアウト（30秒）が設定されること
   - TABLE_NAME環境変数が設定されること
   - DynamoDBへの読み書き権限が付与されること

3. **API Gateway統合テスト**
   - プロキシ統合が設定されること
   - {proxy+}リソースが作成されること
   - ANYメソッドが設定されること

4. **Cognito認証テスト**
   - userPool指定時にCognito Authorizerが作成されること
   - userPool未指定時にAuthorizerが作成されないこと

5. **カスタムヘッダーテスト**
   - デフォルトのヘッダー名が使用されること
   - カスタムヘッダー名が指定できること
   - カスタムシークレットが指定できること

6. **Props上書きテスト**
   - restApiPropsでデフォルト設定が上書きされること
   - lambdaPropsでデフォルト設定が上書きされること

7. **出力テスト**
   - api、handler、apiUrl、customHeaderName、customHeaderSecretが正しく公開されること

### テストファイル構成

```
test/
└── constructs/
    └── api-construct.test.ts
```

### テスト実装例

```typescript
import { App, Stack } from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { ApiConstruct } from '../../lib/constructs/api-construct';

describe('ApiConstruct', () => {
  let app: App;
  let stack: Stack;
  let table: Table;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    table = new Table(stack, 'TestTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  });

  describe('REST API', () => {
    test('creates REST API', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    test('creates REST API with resource policy', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Policy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Deny',
              Condition: Match.anyValue(),
            }),
          ]),
        }),
      });
    });
  });

  describe('Lambda Function', () => {
    test('creates Lambda function with Node.js 20.x runtime', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
      });
    });

    test('creates Lambda function with default memory size', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 128,
      });
    });

    test('creates Lambda function with TABLE_NAME environment variable', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
          },
        },
      });
    });

    test('grants Lambda read/write access to DynamoDB table', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('Cognito Authorizer', () => {
    test('creates Cognito Authorizer when userPool is provided', () => {
      const userPool = new UserPool(stack, 'UserPool');
      new ApiConstruct(stack, 'Api', { table, userPool });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    test('does not create Authorizer when userPool is not provided', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 0);
    });
  });

  describe('Custom Header', () => {
    test('uses default custom header name', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.customHeaderName).toBe('x-origin-verify');
    });

    test('uses custom header name when provided', () => {
      const api = new ApiConstruct(stack, 'Api', {
        table,
        customHeaderName: 'x-custom-header',
      });

      expect(api.customHeaderName).toBe('x-custom-header');
    });

    test('uses custom header secret when provided', () => {
      const api = new ApiConstruct(stack, 'Api', {
        table,
        customHeaderSecret: 'my-secret-value',
      });

      expect(api.customHeaderSecret).toBe('my-secret-value');
    });
  });

  describe('Props Override', () => {
    test('overrides Lambda props', () => {
      new ApiConstruct(stack, 'Api', {
        table,
        lambdaProps: {
          memorySize: 256,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 256,
      });
    });

    test('overrides REST API props', () => {
      new ApiConstruct(stack, 'Api', {
        table,
        restApiProps: {
          description: 'Custom API description',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Description: 'Custom API description',
      });
    });
  });

  describe('Outputs', () => {
    test('exposes api, handler, apiUrl, customHeaderName, customHeaderSecret', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.api).toBeDefined();
      expect(api.handler).toBeDefined();
      expect(api.apiUrl).toBeDefined();
      expect(api.customHeaderName).toBeDefined();
      expect(api.customHeaderSecret).toBeDefined();
    });
  });
});
```
