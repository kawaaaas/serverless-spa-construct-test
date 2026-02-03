# 設計ドキュメント

## 概要

ServerlessSpaは、個人開発者向けのサーバーレスSPAインフラストラクチャを一括でデプロイする高レベルCDKコンストラクトである。DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトを統合し、依存関係を自動的に接続（Auto-wiring）する。全てのPropsはオプショナルで、デフォルト設定でセキュアかつコスト最適化されたインフラを構築する。RemovalPolicyとタグの一括適用機能により、環境管理とコスト追跡を容易にする。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  ServerlessSpa                                       │
│                                                                                      │
│  Props:                                                                              │
│  - database?: DatabaseConstructProps                                                 │
│  - auth?: AuthConstructProps                                                         │
│  - api?: Omit<ApiConstructProps, 'table' | 'userPool'>                              │
│  - frontend?: Omit<FrontendConstructProps, 'api' | 'customHeaderName' | '...'>      │
│  - removalPolicy?: RemovalPolicy                                                     │
│  - tags?: { [key: string]: string }                                                  │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         DatabaseConstruct                                    │    │
│  │                                                                              │    │
│  │  DynamoDB Table (PK/SK, PAY_PER_REQUEST)                                    │    │
│  │                                                                              │    │
│  │  Outputs: table, tableName, tableArn                                        │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ table                                          │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          AuthConstruct                                       │    │
│  │                                                                              │    │
│  │  Cognito User Pool + Client (Email sign-in, SRP auth)                       │    │
│  │                                                                              │    │
│  │  Outputs: userPool, userPoolClient, userPoolId, userPoolClientId            │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ userPool                                       │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           ApiConstruct                                       │    │
│  │                                                                              │    │
│  │  REST API Gateway + Lambda (Node.js 20.x)                                   │    │
│  │  - Cognito Authorizer (JWT validation)                                      │    │
│  │  - Resource Policy (custom header restriction)                              │    │
│  │                                                                              │    │
│  │  Outputs: api, handler, apiUrl, customHeaderName, customHeaderSecret        │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ api, customHeaderName, customHeaderSecret      │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         FrontendConstruct                                    │    │
│  │                                                                              │    │
│  │  S3 Bucket + CloudFront Distribution                                        │    │
│  │  - OAC for S3 access                                                        │    │
│  │  - CloudFront Function for SPA routing                                      │    │
│  │  - /api/* behavior for API Gateway                                          │    │
│  │                                                                              │    │
│  │  Outputs: bucket, distribution, distributionDomainName                      │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  Outputs (Convenience Properties):                                                   │
│  - distributionDomainName: string                                                    │
│  - apiUrl: string                                                                    │
│  - userPoolId: string                                                                │
│  - userPoolClientId: string                                                          │
│  - tableName: string                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## コンポーネントとインターフェース

### ServerlessSpaProps

```typescript
import { RemovalPolicy } from 'aws-cdk-lib/core';
import { DatabaseConstructProps } from './database-construct';
import { AuthConstructProps } from './auth-construct';
import { ApiConstructProps } from './api-construct';
import { FrontendConstructProps } from './frontend-construct';

export interface ServerlessSpaProps {
  /**
   * Optional DatabaseConstruct properties.
   * These will be passed through to DatabaseConstruct.
   */
  readonly database?: DatabaseConstructProps;

  /**
   * Optional AuthConstruct properties.
   * These will be passed through to AuthConstruct.
   */
  readonly auth?: AuthConstructProps;

  /**
   * Optional ApiConstruct properties.
   * Note: 'table' and 'userPool' are auto-wired and cannot be overridden.
   */
  readonly api?: Omit<ApiConstructProps, 'table' | 'userPool'>;

  /**
   * Optional FrontendConstruct properties.
   * Note: 'api', 'customHeaderName', and 'customHeaderSecret' are auto-wired
   * and cannot be overridden.
   */
  readonly frontend?: Omit<
    FrontendConstructProps,
    'api' | 'customHeaderName' | 'customHeaderSecret'
  >;

  /**
   * Removal policy to apply to all resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Tags to apply to all resources.
   * @default - No tags
   */
  readonly tags?: { [key: string]: string };
}
```

### ServerlessSpa クラス

```typescript
import { Construct } from 'constructs';
import { RemovalPolicy, Tags } from 'aws-cdk-lib/core';
import { DatabaseConstruct } from './database-construct';
import { AuthConstruct } from './auth-construct';
import { ApiConstruct } from './api-construct';
import { FrontendConstruct } from './frontend-construct';

export class ServerlessSpa extends Construct {
  /**
   * The DatabaseConstruct instance.
   */
  public readonly database: DatabaseConstruct;

  /**
   * The AuthConstruct instance.
   */
  public readonly auth: AuthConstruct;

  /**
   * The ApiConstruct instance.
   */
  public readonly api: ApiConstruct;

  /**
   * The FrontendConstruct instance.
   */
  public readonly frontend: FrontendConstruct;

  /**
   * The domain name of the CloudFront distribution.
   * Convenience property for frontend.distributionDomainName.
   */
  public readonly distributionDomainName: string;

  /**
   * The URL of the REST API endpoint.
   * Convenience property for api.apiUrl.
   */
  public readonly apiUrl: string;

  /**
   * The ID of the Cognito User Pool.
   * Convenience property for auth.userPoolId.
   */
  public readonly userPoolId: string;

  /**
   * The ID of the Cognito User Pool Client.
   * Convenience property for auth.userPoolClientId.
   */
  public readonly userPoolClientId: string;

  /**
   * The name of the DynamoDB table.
   * Convenience property for database.tableName.
   */
  public readonly tableName: string;

  constructor(scope: Construct, id: string, props?: ServerlessSpaProps) {
    super(scope, id);
    // Implementation
  }
}
```

## データモデル

### デフォルト設定値

| 設定項目      | デフォルト値          | 理由                             |
| ------------- | --------------------- | -------------------------------- |
| removalPolicy | RemovalPolicy.DESTROY | 開発環境での迅速なクリーンアップ |
| tags          | なし                  | ユーザーが必要に応じて設定       |

### Auto-wiring マッピング

| ソース                          | ターゲット                           | 説明                         |
| ------------------------------- | ------------------------------------ | ---------------------------- |
| DatabaseConstruct.table         | ApiConstruct.table                   | Lambda用DynamoDBテーブル     |
| AuthConstruct.userPool          | ApiConstruct.userPool                | JWT認証用User Pool           |
| ApiConstruct.api                | FrontendConstruct.api                | /api/\*ルーティング用        |
| ApiConstruct.customHeaderName   | FrontendConstruct.customHeaderName   | CloudFront→API Gateway制限用 |
| ApiConstruct.customHeaderSecret | FrontendConstruct.customHeaderSecret | CloudFront→API Gateway制限用 |

### RemovalPolicy適用対象

| リソース                | 適用方法                                      |
| ----------------------- | --------------------------------------------- |
| DynamoDB Table          | tableProps.removalPolicy                      |
| S3 Bucket               | bucketProps.removalPolicy + autoDeleteObjects |
| Cognito User Pool       | CDKデフォルト（スタックレベル）               |
| CloudFront Distribution | CDKデフォルト（スタックレベル）               |

### タグ適用

CDKのTagsクラスを使用して、ServerlessSpaコンストラクト配下の全リソースにタグを一括適用する。

```typescript
if (props?.tags) {
  Object.entries(props.tags).forEach(([key, value]) => {
    Tags.of(this).add(key, value);
  });
}
```

## 実装フロー

```
1. ServerlessSpa constructor
   │
   ├─► Apply tags (if provided)
   │
   ├─► Determine removalPolicy (default: DESTROY)
   │
   ├─► Create DatabaseConstruct
   │   └─► Pass database props + removalPolicy
   │
   ├─► Create AuthConstruct
   │   └─► Pass auth props
   │
   ├─► Create ApiConstruct
   │   ├─► Auto-wire: table from DatabaseConstruct
   │   ├─► Auto-wire: userPool from AuthConstruct
   │   └─► Pass api props
   │
   ├─► Create FrontendConstruct
   │   ├─► Auto-wire: api from ApiConstruct
   │   ├─► Auto-wire: customHeaderName from ApiConstruct
   │   ├─► Auto-wire: customHeaderSecret from ApiConstruct
   │   ├─► Pass frontend props + removalPolicy (for S3)
   │   └─► Set autoDeleteObjects based on removalPolicy
   │
   └─► Set convenience properties
       ├─► distributionDomainName = frontend.distributionDomainName
       ├─► apiUrl = api.apiUrl
       ├─► userPoolId = auth.userPoolId
       ├─► userPoolClientId = auth.userPoolClientId
       └─► tableName = database.tableName
```

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: 全コンストラクト作成

_任意の_ ServerlessSpaインスタンスにおいて、Propsの有無に関わらず、DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトが全て作成される。

**検証対象: 要件 1.1, 1.2, 1.3, 1.4, 1.5, 6.1**

### プロパティ2: Auto-wiring - Database to Api

_任意の_ ServerlessSpaインスタンスにおいて、ApiConstructのLambda関数はDatabaseConstructで作成されたDynamoDBテーブルへの読み書き権限を持ち、TABLE_NAME環境変数にそのテーブル名が設定される。

**検証対象: 要件 2.1**

### プロパティ3: Auto-wiring - Auth to Api

_任意の_ ServerlessSpaインスタンスにおいて、ApiConstructにはAuthConstructで作成されたCognito User Poolを使用するCognito Authorizerが設定される。

**検証対象: 要件 2.2**

### プロパティ4: Auto-wiring - Api to Frontend

_任意の_ ServerlessSpaインスタンスにおいて、FrontendConstructのCloudFrontディストリビューションには/api/\*パスがApiConstructのAPI Gatewayにルーティングされ、ApiConstructのcustomHeaderNameとcustomHeaderSecretがカスタムヘッダーとして設定される。

**検証対象: 要件 2.3, 2.4, 2.5**

### プロパティ5: Props透過的転送

_任意の_ ServerlessSpaインスタンスにおいて、database、auth、api、frontendプロパティで指定された設定は、対応する低レベルコンストラクトに正しく透過的に渡される（Auto-wiredプロパティを除く）。

**検証対象: 要件 3.1, 3.2, 3.3, 3.4**

### プロパティ6: リソース参照と便利プロパティの公開

_任意の_ ServerlessSpaインスタンスにおいて、database、auth、api、frontendプロパティとして各コンストラクトインスタンスが公開され、distributionDomainName、apiUrl、userPoolId、userPoolClientId、tableNameの便利プロパティが対応するコンストラクトの値と一致する。

**検証対象: 要件 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5**

### プロパティ7: RemovalPolicy一括適用

_任意の_ ServerlessSpaインスタンスにおいて、removalPolicyプロパティで指定されたRemovalPolicyがDynamoDBテーブルとS3バケットに適用される。DESTROYの場合はS3のautoDeleteObjectsがtrue、RETAIN/SNAPSHOTの場合はfalseに設定される。デフォルトはDESTROYである。

**検証対象: 要件 7.1, 7.2, 7.3, 7.4**

### プロパティ8: タグ一括適用

_任意の_ ServerlessSpaインスタンスにおいて、tagsプロパティで指定されたタグが全ての子リソースに適用される。

**検証対象: 要件 8.1, 8.3**

## エラーハンドリング

### バリデーション

ServerlessSpaは最小限のバリデーションを行い、CDKの既存機能を活用する：

1. **Props型チェック**: TypeScriptの型システムによる静的チェック
2. **低レベルコンストラクトのバリデーション**: 各低レベルコンストラクトが独自のバリデーションを実行

### エラーメッセージ

CDKの標準的なバリデーションエラーメッセージを使用する。ServerlessSpa固有のカスタムバリデーションは不要（Auto-wiringにより依存関係が自動的に解決されるため）。

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

**注意**: このコンストラクトはCDKの設定検証が主目的のため、プロパティベーステストではなくCDK Assertionsによるユニットテストを使用する。

### テストケース

1. **全コンストラクト作成テスト**
   - DynamoDBテーブルが作成されること
   - Cognito User PoolとClientが作成されること
   - API GatewayとLambdaが作成されること
   - S3バケットとCloudFrontディストリビューションが作成されること

2. **Auto-wiringテスト**
   - LambdaがDynamoDBへの読み書き権限を持つこと
   - LambdaのTABLE_NAME環境変数が設定されること
   - Cognito Authorizerが作成されること
   - CloudFrontの/api/\*ビヘイビアが存在すること

3. **Props透過的転送テスト**
   - databaseプロパティがDatabaseConstructに渡されること
   - authプロパティがAuthConstructに渡されること
   - apiプロパティがApiConstructに渡されること
   - frontendプロパティがFrontendConstructに渡されること

4. **出力プロパティテスト**
   - database、auth、api、frontendプロパティが公開されること
   - 便利プロパティが正しい値を返すこと

5. **RemovalPolicyテスト**
   - デフォルトでDESTROYが適用されること
   - カスタムRemovalPolicyが適用されること
   - DESTROYの場合autoDeleteObjectsがtrueであること
   - RETAINの場合autoDeleteObjectsがfalseであること

6. **タグテスト**
   - 指定されたタグが全リソースに適用されること
   - 複数タグが正しく適用されること

### テストファイル構成

```
test/
└── constructs/
    └── serverless-spa.test.ts
```

### テスト実装例

```typescript
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ServerlessSpa } from '../../lib/constructs/serverless-spa';

describe('ServerlessSpa', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('All Constructs Creation', () => {
    test('creates all resources with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);

      // DynamoDB
      template.resourceCountIs('AWS::DynamoDB::Table', 1);

      // Cognito
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);

      // API Gateway + Lambda
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
      template.resourceCountIs('AWS::Lambda::Function', 1);

      // S3 + CloudFront
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
  });

  describe('Auto-wiring', () => {
    test('Lambda has DynamoDB read/write permissions', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:GetItem', 'dynamodb:PutItem']),
            }),
          ]),
        },
      });
    });

    test('Lambda has TABLE_NAME environment variable', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
          },
        },
      });
    });

    test('creates Cognito Authorizer', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    test('CloudFront has /api/* behavior', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
            }),
          ]),
        },
      });
    });
  });

  describe('Props Pass-through', () => {
    test('passes database props to DatabaseConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        database: {
          tableName: 'CustomTable',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'CustomTable',
      });
    });

    test('passes api props to ApiConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        api: {
          lambdaProps: {
            memorySize: 256,
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 256,
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes all construct instances', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.database).toBeDefined();
      expect(spa.auth).toBeDefined();
      expect(spa.api).toBeDefined();
      expect(spa.frontend).toBeDefined();
    });

    test('exposes convenience properties', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.distributionDomainName).toBeDefined();
      expect(spa.apiUrl).toBeDefined();
      expect(spa.userPoolId).toBeDefined();
      expect(spa.userPoolClientId).toBeDefined();
      expect(spa.tableName).toBeDefined();
    });
  });

  describe('RemovalPolicy', () => {
    test('applies DESTROY by default', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
      });
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
      });
    });

    test('applies custom RemovalPolicy', () => {
      new ServerlessSpa(stack, 'App', {
        removalPolicy: RemovalPolicy.RETAIN,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
      });
    });
  });

  describe('Tags', () => {
    test('applies tags to all resources', () => {
      new ServerlessSpa(stack, 'App', {
        tags: {
          Environment: 'test',
          Project: 'my-app',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'my-app' },
        ]),
      });
    });
  });
});
```
