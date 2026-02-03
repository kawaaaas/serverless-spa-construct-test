# 設計ドキュメント

## 概要

AuthConstructは、Cognito User Poolを作成する低レベルCDKコンストラクトである。個人開発者向けにコスト最適化されたLiteティアをデフォルトで使用し、SPA認証に最適化された設定を提供する。Propsパターンにより柔軟なカスタマイズが可能で、他のコンストラクト（ApiConstruct等）から参照できるようUser Pool情報を公開する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    AuthConstruct                         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Cognito User Pool                   │    │
│  │                                                  │    │
│  │  Sign-in: Email as username                     │    │
│  │  Self sign-up: Enabled                          │    │
│  │  Email verification: Enabled                    │    │
│  │                                                  │    │
│  │  Password Policy:                               │    │
│  │  - Min length: 8                                │    │
│  │  - Require lowercase: Yes                       │    │
│  │  - Require digits: Yes                          │    │
│  │                                                  │    │
│  │  Tier: Lite (cost-optimized)                   │    │
│  │  Removal Policy: Stack level (not set here)   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │            User Pool Client                      │    │
│  │                                                  │    │
│  │  - No client secret (SPA)                       │    │
│  │  - USER_SRP_AUTH flow                           │    │
│  │  - ALLOW_REFRESH_TOKEN_AUTH flow                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Outputs:                                                │
│  - userPool: IUserPool                                   │
│  - userPoolClient: IUserPoolClient                       │
│  - userPoolId: string                                    │
│  - userPoolClientId: string                              │
└─────────────────────────────────────────────────────────┘
```

## コンポーネントとインターフェース

### AuthConstructProps

```typescript
import { UserPoolProps, UserPoolClientProps } from 'aws-cdk-lib/aws-cognito';

export interface AuthConstructProps {
  /**
   * Additional User Pool properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly userPoolProps?: Partial<UserPoolProps>;

  /**
   * Additional User Pool Client properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly userPoolClientProps?: Partial<UserPoolClientProps>;
}
```

### AuthConstruct クラス

```typescript
import { Construct } from 'constructs';
import { IUserPool, IUserPoolClient, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { RemovalPolicy } from 'aws-cdk-lib/core';

export class AuthConstruct extends Construct {
  /**
   * The Cognito User Pool created by this construct.
   */
  public readonly userPool: IUserPool;

  /**
   * The Cognito User Pool Client created by this construct.
   */
  public readonly userPoolClient: IUserPoolClient;

  /**
   * The ID of the Cognito User Pool.
   */
  public readonly userPoolId: string;

  /**
   * The ID of the Cognito User Pool Client.
   */
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: AuthConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

## データモデル

### デフォルト設定値

| 設定項目                        | デフォルト値 | 理由                           |
| ------------------------------- | ------------ | ------------------------------ |
| selfSignUpEnabled               | true         | SPAでのユーザー自己登録を許可  |
| signInAliases.email             | true         | メールアドレスでのサインイン   |
| autoVerify.email                | true         | メールアドレスの自動検証       |
| passwordPolicy.minLength        | 8            | セキュリティと利便性のバランス |
| passwordPolicy.requireLowercase | true         | 基本的なセキュリティ要件       |
| passwordPolicy.requireDigits    | true         | 基本的なセキュリティ要件       |
| passwordPolicy.requireUppercase | false        | 利便性を優先                   |
| passwordPolicy.requireSymbols   | false        | 利便性を優先                   |
| removalPolicy                   | (未設定)     | スタックレベルで一括管理       |

### User Pool Client設定

| 設定項目               | デフォルト値 | 理由                                        |
| ---------------------- | ------------ | ------------------------------------------- |
| generateSecret         | false        | SPAではクライアントシークレットを使用しない |
| authFlows.userSrp      | true         | セキュアなSRP認証フロー                     |
| authFlows.custom       | false        | カスタム認証は不要                          |
| authFlows.userPassword | false        | セキュリティ上の理由で無効                  |

### Liteティアの制約

Liteティアでは以下の機能が使用できない（Essentialsティアが必要）:

| 機能                   | 利用可否 | 備考                 |
| ---------------------- | -------- | -------------------- |
| パスキー（WebAuthn）   | ❌       | Essentialsティア必須 |
| 高度なセキュリティ機能 | ❌       | 追加コスト発生       |
| カスタムSMSメッセージ  | ✅       | Liteで利用可能       |
| メール検証             | ✅       | Liteで利用可能       |
| SRP認証                | ✅       | Liteで利用可能       |

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: userPoolProps上書き

_任意の_ userPoolProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。これにはパスワードポリシー、その他のUser Pool設定が含まれる。

**検証対象: 要件 1.5, 4.4**

### プロパティ2: userPoolClientProps上書き

_任意の_ userPoolClientProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。

**検証対象: 要件 2.5**

## エラーハンドリング

### バリデーション

AuthConstructは最小限のバリデーションを行い、CDKの既存機能を活用する：

1. **Props型チェック**: TypeScriptの型システムによる静的チェック
2. **CDK標準バリデーション**: Cognito関連の設定はCDKが自動的に検証

### エラーメッセージ

CDKの標準的なバリデーションエラーメッセージを使用する。カスタムバリデーションは不要（AuthConstructには複雑な依存関係がないため）。

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

### テストケース

1. **User Pool作成テスト**
   - User Poolリソースが作成されること
   - セルフサインアップが有効であること
   - メールアドレスがサインインエイリアスとして設定されること
   - メールアドレスの自動検証が有効であること

2. **User Pool Client作成テスト**
   - User Pool Clientリソースが作成されること
   - クライアントシークレットが生成されないこと
   - USER_SRP_AUTH認証フローが有効であること
   - ALLOW_REFRESH_TOKEN_AUTH認証フローが有効であること

3. **コスト最適化テスト**
   - 高度なセキュリティ機能が無効であること（UserPoolAddOnsがないこと）

4. **パスワードポリシーテスト**
   - 最小パスワード長が8文字であること
   - 小文字が必須であること
   - 数字が必須であること

5. **Props上書きテスト**
   - userPoolPropsでデフォルト設定が上書きされること
   - userPoolClientPropsでデフォルト設定が上書きされること

6. **出力テスト**
   - userPool、userPoolClient、userPoolId、userPoolClientIdが正しく公開されること

### テストファイル構成

```
test/
└── constructs/
    └── auth-construct.test.ts
```

### テスト実装例

```typescript
import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthConstruct } from '../../lib/constructs/auth-construct';

describe('AuthConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('User Pool', () => {
    test('creates User Pool with self sign-up enabled', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      });
    });

    test('creates User Pool with email as sign-in alias', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
        AutoVerifiedAttributes: ['email'],
      });
    });

    test('creates User Pool with password policy', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireNumbers: true,
          },
        },
      });
    });
  });

  describe('User Pool Client', () => {
    test('creates User Pool Client without secret', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        GenerateSecret: false,
      });
    });

    test('creates User Pool Client with SRP auth flow', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      });
    });
  });

  describe('Props override', () => {
    test('overrides User Pool props', () => {
      new AuthConstruct(stack, 'Auth', {
        userPoolProps: {
          userPoolName: 'CustomPoolName',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'CustomPoolName',
      });
    });
  });

  describe('Outputs', () => {
    test('exposes userPool and userPoolClient', () => {
      const auth = new AuthConstruct(stack, 'Auth');

      expect(auth.userPool).toBeDefined();
      expect(auth.userPoolClient).toBeDefined();
      expect(auth.userPoolId).toBeDefined();
      expect(auth.userPoolClientId).toBeDefined();
    });
  });
});
```
