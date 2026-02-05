# 設計ドキュメント

## 概要

ServerlessSpaSecurityConstructは、CloudFront用のWAF WebACLとSecrets Managerによるカスタムヘッダーローテーションを提供するus-east-1専用のL3コンストラクトである。WAFはCloudFrontのSCOPE要件によりus-east-1でのみ作成可能なため、このコンストラクトはus-east-1専用として設計される。SSM Parameter Store経由でメインリージョン（ap-northeast-1等）のServerlessSpaと連携し、クロスリージョンでのセキュリティ設定共有を実現する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           us-east-1 (SecurityStack)                                  │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                   ServerlessSpaSecurityConstruct (高レベル)                  │    │
│  │                                                                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │    │
│  │  │ WafConstruct    │  │ SecretConstruct │  │ SsmConstruct    │             │    │
│  │  │ (低レベル)      │  │ (低レベル)      │  │ (低レベル)      │             │    │
│  │  │                 │  │                 │  │                 │             │    │
│  │  │ - WAF WebACL    │  │ - Secret        │  │ - waf-acl-arn   │             │    │
│  │  │ - Rate Limit    │  │ - Rotation      │  │ - header-name   │             │    │
│  │  │ - Managed Rules │  │   Lambda        │  │ - secret-arn    │             │    │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │    │
│  │           │                    │                    │                       │    │
│  │           └────────────────────┴────────────────────┘                       │    │
│  │                                                                              │    │
│  │  Outputs: webAclArn, secretArn, customHeaderName, ssmPrefix                 │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ SSM GetParameter (Cross-Region)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        ap-northeast-1 (AppStack)                                     │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                    ServerlessSpa (Extended)                                  │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │    │
│  │  │              AwsCustomResource (SSM GetParameter)                    │   │    │
│  │  │                                                                      │   │    │
│  │  │  - Region: us-east-1                                                │   │    │
│  │  │  - Parameters: waf-acl-arn, custom-header-name, secret-arn          │   │    │
│  │  └─────────────────────────────────────────────────────────────────────┘   │    │
│  │                    │                    │                    │              │    │
│  │                    ▼                    ▼                    ▼              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │    │
│  │  │ FrontendConst.  │  │ ApiConstruct    │  │ Lambda          │             │    │
│  │  │                 │  │                 │  │                 │             │    │
│  │  │ CloudFront      │  │ Resource Policy │  │ Secrets Manager │             │    │
│  │  │ + WAF WebACL    │  │ + Header Check  │  │ GetSecretValue  │             │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## コンストラクト階層

```
ServerlessSpaSecurityConstruct (高レベル)
├── WafConstruct (低レベル)
│   └── WAF WebACL (CLOUDFRONT scope)
├── SecretConstruct (低レベル)
│   ├── Secrets Manager Secret
│   └── Rotation Lambda
└── SsmConstruct (低レベル)
    ├── SSM Parameter (waf-acl-arn)
    ├── SSM Parameter (custom-header-name)
    └── SSM Parameter (secret-arn)
```

## ファイル構成

```
lib/
├── constructs/
│   ├── serverless-spa-security-construct.ts  # High-level construct
│   ├── waf-construct.ts                      # Low-level: WAF WebACL
│   ├── secret-construct.ts                   # Low-level: Secrets Manager + Rotation
│   └── ssm-construct.ts                      # Low-level: SSM Parameters
├── lambda/
│   └── rotation-handler.ts                   # Rotation Lambda handler
└── index.ts                                  # Public exports (updated)
```

## コンポーネントとインターフェース

### WafConstructProps

```typescript
import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';

/**
 * WAF rule configuration for custom rules.
 */
export interface WafRuleConfig {
  /**
   * Rule name.
   */
  readonly name: string;

  /**
   * Rule priority. Lower numbers are evaluated first.
   */
  readonly priority: number;

  /**
   * Rule statement defining the match conditions.
   */
  readonly statement: CfnWebACL.StatementProperty;

  /**
   * Action to take when the rule matches.
   * Use { block: {} } to block, { allow: {} } to allow, { count: {} } to count only.
   * For managed rule groups, use overrideAction instead.
   */
  readonly action?: CfnWebACL.RuleActionProperty;

  /**
   * Override action for managed rule groups.
   * Use { none: {} } to use the rule group's actions, or { count: {} } to count only.
   */
  readonly overrideAction?: CfnWebACL.OverrideActionProperty;

  /**
   * CloudWatch metrics configuration.
   */
  readonly visibilityConfig?: CfnWebACL.VisibilityConfigProperty;
}

export interface WafConstructProps {
  /**
   * Rate limit for WAF (requests per 5 minutes).
   * Set to 0 to disable the default rate limiting rule.
   * @default 2000
   */
  readonly rateLimit?: number;

  /**
   * Whether to include AWS Managed Rules Common Rule Set.
   * @default true
   */
  readonly enableCommonRuleSet?: boolean;

  /**
   * Whether to include AWS Managed Rules SQLi Rule Set.
   * @default true
   */
  readonly enableSqliRuleSet?: boolean;

  /**
   * Custom WAF rules to add.
   * These rules will be added after the default rules.
   * @default - No custom rules
   */
  readonly customRules?: WafRuleConfig[];

  /**
   * Completely override all rules with custom configuration.
   * When provided, rateLimit, enableCommonRuleSet, enableSqliRuleSet, and customRules are ignored.
   * Use this for full control over WAF rules.
   * @default - Uses default rules with optional customRules
   */
  readonly rules?: CfnWebACL.RuleProperty[];

  /**
   * Default action when no rules match.
   * @default { allow: {} }
   */
  readonly defaultAction?: CfnWebACL.DefaultActionProperty;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

### WafConstruct クラス

```typescript
import { Construct } from 'constructs';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';

export class WafConstruct extends Construct {
  /**
   * The WAF WebACL.
   */
  public readonly webAcl: CfnWebACL;

  /**
   * The WAF WebACL ARN.
   */
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props?: WafConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### SecretConstructProps

```typescript
import { RemovalPolicy } from 'aws-cdk-lib';

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
   * Required for rotation Lambda to update SSM parameters.
   */
  readonly ssmPrefix?: string;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

### SecretConstruct クラス

```typescript
import { Construct } from 'constructs';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { IFunction } from 'aws-cdk-lib/aws-lambda';

export class SecretConstruct extends Construct {
  /**
   * The Secrets Manager secret.
   */
  public readonly secret: ISecret;

  /**
   * The Secrets Manager secret ARN.
   */
  public readonly secretArn: string;

  /**
   * The custom header name.
   */
  public readonly customHeaderName: string;

  /**
   * The rotation Lambda function.
   */
  public readonly rotationFunction: IFunction;

  constructor(scope: Construct, id: string, props?: SecretConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### SsmConstructProps

```typescript
export interface SsmConstructProps {
  /**
   * SSM Parameter Store prefix for cross-region sharing.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * WAF WebACL ARN to store in SSM.
   */
  readonly webAclArn: string;

  /**
   * Custom header name to store in SSM.
   */
  readonly customHeaderName: string;

  /**
   * Secret ARN to store in SSM.
   */
  readonly secretArn: string;
}
```

### SsmConstruct クラス

```typescript
import { Construct } from 'constructs';
import { IStringParameter } from 'aws-cdk-lib/aws-ssm';

export class SsmConstruct extends Construct {
  /**
   * The SSM Parameter for WAF ACL ARN.
   */
  public readonly wafAclArnParameter: IStringParameter;

  /**
   * The SSM Parameter for custom header name.
   */
  public readonly customHeaderNameParameter: IStringParameter;

  /**
   * The SSM Parameter for secret ARN.
   */
  public readonly secretArnParameter: IStringParameter;

  /**
   * The SSM prefix used for parameters.
   */
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: SsmConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### ServerlessSpaSecurityConstructProps

```typescript
import { RemovalPolicy } from 'aws-cdk-lib';

export interface ServerlessSpaSecurityConstructProps {
  /**
   * Optional WafConstruct properties.
   * These will be passed through to WafConstruct.
   */
  readonly waf?: WafConstructProps;

  /**
   * Optional SecretConstruct properties.
   * These will be passed through to SecretConstruct.
   * Note: 'ssmPrefix' is auto-wired from ssm.ssmPrefix.
   */
  readonly secret?: Omit<SecretConstructProps, 'ssmPrefix'>;

  /**
   * Optional SsmConstruct properties.
   * Note: 'webAclArn', 'customHeaderName', 'secretArn' are auto-wired.
   */
  readonly ssm?: Pick<SsmConstructProps, 'ssmPrefix'>;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

### ServerlessSpaSecurityConstruct クラス

```typescript
import { Construct } from 'constructs';

export class ServerlessSpaSecurityConstruct extends Construct {
  /**
   * The WafConstruct instance.
   */
  public readonly waf: WafConstruct;

  /**
   * The SecretConstruct instance.
   */
  public readonly secret: SecretConstruct;

  /**
   * The SsmConstruct instance.
   */
  public readonly ssm: SsmConstruct;

  /**
   * The WAF WebACL ARN for CloudFront.
   * Convenience property for waf.webAclArn.
   */
  public readonly webAclArn: string;

  /**
   * The Secrets Manager secret ARN.
   * Convenience property for secret.secretArn.
   */
  public readonly secretArn: string;

  /**
   * The custom header name.
   * Convenience property for secret.customHeaderName.
   */
  public readonly customHeaderName: string;

  /**
   * The SSM prefix used for parameters.
   * Convenience property for ssm.ssmPrefix.
   */
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props?: ServerlessSpaSecurityConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### ServerlessSpaProps拡張

```typescript
export interface SecurityConfig {
  /**
   * SSM Parameter Store prefix where security values are stored.
   * Must match the prefix used in ServerlessSpaSecurityConstruct.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * The region where ServerlessSpaSecurityConstruct is deployed.
   * @default 'us-east-1'
   */
  readonly securityRegion?: string;
}

export interface ServerlessSpaProps {
  // ... existing props ...

  /**
   * Security configuration for WAF and custom header.
   * If provided, enables cross-region security integration.
   */
  readonly security?: SecurityConfig;
}
```

## データモデル

### SSM Parameter パス構造

| パラメータ名                    | 値                  | 説明                             |
| ------------------------------- | ------------------- | -------------------------------- |
| `{ssmPrefix}waf-acl-arn`        | WAF WebACL ARN      | CloudFrontに適用するWAF ARN      |
| `{ssmPrefix}custom-header-name` | x-origin-verify     | カスタムヘッダー名               |
| `{ssmPrefix}secret-arn`         | Secrets Manager ARN | カスタムヘッダー値のシークレット |

### WAF WebACL ルール構成

#### デフォルトルール

| ルール名                     | 優先度 | アクション | 説明                             | 制御プロパティ        |
| ---------------------------- | ------ | ---------- | -------------------------------- | --------------------- |
| RateLimitRule                | 1      | Block      | レート制限（デフォルト2000/5分） | `rateLimit`           |
| AWSManagedRulesCommonRuleSet | 2      | Block      | 一般的なWeb攻撃対策              | `enableCommonRuleSet` |
| AWSManagedRulesSQLiRuleSet   | 3      | Block      | SQLインジェクション対策          | `enableSqliRuleSet`   |

#### ルールカスタマイズオプション

| オプション            | 説明                                                            |
| --------------------- | --------------------------------------------------------------- |
| `enableCommonRuleSet` | `false`でAWSManagedRulesCommonRuleSetを無効化                   |
| `enableSqliRuleSet`   | `false`でAWSManagedRulesSQLiRuleSetを無効化                     |
| `rateLimit`           | `0`でレート制限ルールを無効化、正の値でカスタムレート制限を設定 |
| `customRules`         | デフォルトルールの後に追加するカスタムルール                    |
| `rules`               | 全ルールを完全に上書き（他のルール設定は無視される）            |

#### カスタムルール使用例

```typescript
// カスタムルールを追加
const waf = new WafConstruct(this, 'Waf', {
  customRules: [
    {
      name: 'BlockBadBots',
      priority: 10,
      statement: {
        byteMatchStatement: {
          searchString: 'BadBot',
          fieldToMatch: { singleHeader: { name: 'user-agent' } },
          textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
          positionalConstraint: 'CONTAINS',
        },
      },
      action: { block: {} },
    },
  ],
});

// 全ルールを完全にカスタマイズ
const waf = new WafConstruct(this, 'Waf', {
  rules: [
    // 独自のルール構成
  ],
});
```

### Secrets Manager シークレット構造

```json
{
  "headerValue": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### デフォルト設定値

| 設定項目         | デフォルト値       | 理由                                   |
| ---------------- | ------------------ | -------------------------------------- |
| ssmPrefix        | '/myapp/security/' | 一般的なプレフィックス                 |
| customHeaderName | 'x-origin-verify'  | 既存実装との互換性                     |
| rateLimit        | 2000               | 一般的なSPAに適切な値                  |
| rotationDays     | 7                  | セキュリティとオペレーションのバランス |
| removalPolicy    | DESTROY            | 開発環境での迅速なクリーンアップ       |

## 実装フロー

### ServerlessSpaSecurityConstruct 作成フロー

```
1. ServerlessSpaSecurityConstruct constructor
   │
   ├─► Validate region is us-east-1
   │   └─► Throw error if not us-east-1
   │
   ├─► Create WafConstruct
   │   └─► WAF WebACL with rules
   │
   ├─► Create SecretConstruct
   │   ├─► Secrets Manager Secret
   │   └─► Rotation Lambda
   │
   ├─► Create SsmConstruct (auto-wired)
   │   ├─► {ssmPrefix}waf-acl-arn ← waf.webAclArn
   │   ├─► {ssmPrefix}custom-header-name ← secret.customHeaderName
   │   └─► {ssmPrefix}secret-arn ← secret.secretArn
   │
   └─► Set convenience properties
```

### ServerlessSpa セキュリティ統合フロー

```
1. ServerlessSpa constructor (with security config)
   │
   ├─► Create AwsCustomResource for SSM GetParameter
   │   ├─► Region: us-east-1 (or securityRegion)
   │   ├─► Get waf-acl-arn
   │   ├─► Get custom-header-name
   │   └─► Get secret-arn
   │
   ├─► Create DatabaseConstruct (unchanged)
   │
   ├─► Create AuthConstruct (unchanged)
   │
   ├─► Create ApiConstruct (extended)
   │   ├─► Pass secretArn for header validation
   │   └─► Lambda gets secret value at runtime
   │
   └─► Create FrontendConstruct (extended)
       └─► Pass webAclArn to CloudFront
```

### ローテーションLambda フロー

```
1. Rotation Lambda invoked
   │
   ├─► Generate new UUID
   │
   ├─► Update Secrets Manager
   │   └─► Put new secret value
   │
   ├─► Update SSM Parameter
   │   └─► Update {ssmPrefix}secret-arn (if needed)
   │
   └─► Return success
```

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: WAF WebACL作成と構成

_任意の_ WafConstructインスタンスにおいて、SCOPE: CLOUDFRONTのWAF WebACLが作成される。デフォルトでは、レート制限ルール、AWSManagedRulesCommonRuleSet、AWSManagedRulesSQLiRuleSetの3つのルールが含まれる。

**検証対象: 要件 1.1, 1.2, 1.3, 1.4**

### プロパティ1.1: WAFルールカスタマイズ

_任意の_ WafConstructインスタンスにおいて、`enableCommonRuleSet`、`enableSqliRuleSet`、`rateLimit`プロパティでデフォルトルールの有効/無効を制御できる。`customRules`でカスタムルールを追加でき、`rules`で全ルールを完全に上書きできる。

**検証対象: 要件 1.7, 1.8, 1.9**

### プロパティ2: Secrets Managerとローテーション設定

_任意の_ SecretConstructインスタンスにおいて、カスタムヘッダー値を格納するSecrets Managerシークレットが作成され、ローテーション用Lambda関数が設定される。

**検証対象: 要件 2.1, 3.1**

### プロパティ3: SSM Parameter作成

_任意の_ SsmConstructインスタンスにおいて、{ssmPrefix}waf-acl-arn、{ssmPrefix}custom-header-name、{ssmPrefix}secret-arnの3つのSSM Parameterが作成される。

**検証対象: 要件 4.1, 4.2, 4.3, 4.6**

### プロパティ4: 出力プロパティの公開

_任意の_ ServerlessSpaSecurityConstructインスタンスにおいて、webAclArn、secretArn、customHeaderName、ssmPrefixプロパティが公開され、対応するリソースの値と一致する。

**検証対象: 要件 1.6, 2.3, 2.4**

### プロパティ5: Props透過的転送

_任意の_ ServerlessSpaSecurityConstructインスタンスにおいて、waf.rateLimit、secret.rotationDays、ssm.ssmPrefixプロパティで指定された値が対応する低レベルコンストラクトに正しく転送される。

**検証対象: 要件 1.5, 3.4, 4.4**

### プロパティ6: デフォルト設定

_任意の_ ServerlessSpaSecurityConstructインスタンスにおいて、Propsが指定されない場合、rateLimit=2000、rotationDays=7、ssmPrefix='/myapp/security/'、customHeaderName='x-origin-verify'のデフォルト値が使用される。

**検証対象: 要件 3.5, 4.5**

### プロパティ7: クロスリージョンSSM取得

_任意の_ ServerlessSpaインスタンスにおいて、securityプロパティが指定された場合、AwsCustomResourceがus-east-1リージョンを明示的に指定してSSM GetParameterを呼び出す。

**検証対象: 要件 5.1, 5.4**

### プロパティ8: CloudFront WAF適用

_任意の_ ServerlessSpaインスタンスにおいて、securityプロパティが指定された場合はCloudFrontディストリビューションにWAF WebACLが適用され、指定されない場合はWAFは適用されない。

**検証対象: 要件 5.2, 6.1, 6.2**

### プロパティ9: ApiConstruct Secrets Manager統合

_任意の_ ServerlessSpaインスタンスにおいて、securityプロパティが指定された場合、ApiConstructのLambda関数はSecrets Managerからカスタムヘッダー値を取得する権限を持つ。

**検証対象: 要件 5.3, 7.1**

### プロパティ10: リージョンバリデーション

_任意の_ us-east-1以外のリージョンでServerlessSpaSecurityConstructをインスタンス化しようとした場合、エラーが発生する。

**検証対象: 要件 8.4**

## エラーハンドリング

### バリデーション

ServerlessSpaSecurityConstructは以下のバリデーションを実行する：

1. **リージョンチェック**: us-east-1以外のリージョンでインスタンス化された場合にエラーを発生させる
2. **Props型チェック**: TypeScriptの型システムによる静的チェック

```typescript
// Region validation
const region = Stack.of(this).region;
if (region !== 'us-east-1' && !Token.isUnresolved(region)) {
  throw new Error(
    `ServerlessSpaSecurityConstruct must be deployed in us-east-1 region. Current region: ${region}`
  );
}
```

### エラーメッセージ

| エラー条件                | メッセージ                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| us-east-1以外でのデプロイ | "ServerlessSpaSecurityConstruct must be deployed in us-east-1 region. Current region: {region}" |

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

**注意**: このコンストラクトはCDKの設定検証が主目的のため、プロパティベーステストではなくCDK Assertionsによるユニットテストを使用する。ランタイム動作（ローテーションLambdaの実行、API Gatewayのヘッダー検証等）は統合テストで検証する。

### テストケース

#### WafConstruct テスト

1. **WAF WebACL作成テスト**
   - SCOPE: CLOUDFRONTのWAF WebACLが作成されること
   - レート制限ルールが含まれること
   - AWSManagedRulesCommonRuleSetが含まれること
   - AWSManagedRulesSQLiRuleSetが含まれること
   - カスタムrateLimit値が反映されること

#### SecretConstruct テスト

1. **Secrets Manager作成テスト**
   - Secrets Managerシークレットが作成されること
   - ローテーションLambdaが作成されること
   - ローテーション設定が存在すること
   - カスタムrotationDays値が反映されること

#### SsmConstruct テスト

1. **SSM Parameter作成テスト**
   - 3つのSSM Parameterが作成されること
   - パスが正しい形式であること
   - カスタムssmPrefixが反映されること

#### ServerlessSpaSecurityConstruct テスト

1. **統合テスト**
   - 全ての低レベルコンストラクトが作成されること
   - 出力プロパティが正しく公開されること
   - Props透過的転送が機能すること
   - リージョンバリデーションが機能すること

#### ServerlessSpa拡張テスト

1. **AwsCustomResource作成テスト**
   - securityプロパティ指定時にAwsCustomResourceが作成されること
   - us-east-1リージョンが指定されること

2. **CloudFront WAF適用テスト**
   - securityプロパティ指定時にWAFが適用されること
   - securityプロパティ未指定時にWAFが適用されないこと

3. **ApiConstruct統合テスト**
   - securityプロパティ指定時にLambdaがSecrets Manager権限を持つこと

### テストファイル構成

```
test/
└── constructs/
    ├── waf-construct.test.ts
    ├── secret-construct.test.ts
    ├── ssm-construct.test.ts
    ├── serverless-spa-security-construct.test.ts
    └── serverless-spa.test.ts  # 拡張テストを追加
```
