# 設計ドキュメント

## 概要

ServerlessSpaは、個人開発者向けのサーバーレスSPAインフラストラクチャを一括でデプロイする高レベルCDKコンストラクトである。DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトを統合し、依存関係を自動的に接続（Auto-wiring）する。

**ファクトリメソッドパターン**を採用し、ユースケースごとに明確なAPIを提供する。必須プロパティとオプショナルプロパティを明確に分離し、ユーザーが何を設定すべきかを直感的に理解できる設計となっている。

## ファクトリメソッド

### 1. ServerlessSpa.minimal() - 最小構成

CloudFrontデフォルトドメインを使用する最もシンプルな構成。開発・テスト向け。

```typescript
ServerlessSpa.minimal(this, 'App', {
  // === 必須 ===
  lambdaEntry: './src/api/handler.ts',

  // === オプション ===
  advanced: {
    /* 詳細カスタマイズ */
  },
});
```

### 2. ServerlessSpa.withCustomDomain() - カスタムドメイン付き

独自ドメインとACM証明書自動発行。本番環境向け。

```typescript
ServerlessSpa.withCustomDomain(this, 'App', {
  // === 必須 ===
  lambdaEntry: './src/api/handler.ts',
  domainName: 'www.example.com',
  hostedZoneId: 'Z1234567890ABC', // Route53コンソールから取得
  zoneName: 'example.com',

  // === オプション ===
  alternativeDomainNames: ['example.com'],
  advanced: {
    /* 詳細カスタマイズ */
  },
});
```

### 3. ServerlessSpa.withWaf() - WAF保護付き

WAF WebACLによるセキュリティ保護。SecurityStackのus-east-1デプロイが前提。

```typescript
ServerlessSpa.withWaf(this, 'App', {
  // === 必須 ===
  lambdaEntry: './src/api/handler.ts',
  ssmPrefix: '/myapp/security/',

  // === オプション ===
  securityRegion: 'us-east-1',
  advanced: {
    /* 詳細カスタマイズ */
  },
});
```

### 4. ServerlessSpa.withCustomDomainAndWaf() - フル構成

カスタムドメイン + WAF保護の完全構成。

```typescript
ServerlessSpa.withCustomDomainAndWaf(this, 'App', {
  // === 必須 ===
  lambdaEntry: './src/api/handler.ts',
  domainName: 'www.example.com',
  hostedZoneId: 'Z1234567890ABC',
  zoneName: 'example.com',
  ssmPrefix: '/myapp/security/',

  // === オプション ===
  alternativeDomainNames: ['example.com'],
  securityRegion: 'us-east-1',
  advanced: {
    /* 詳細カスタマイズ */
  },
});
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  ServerlessSpa                                       │
│                                                                                      │
│  Factory Methods:                                                                    │
│  - minimal(props: MinimalProps)                                                      │
│  - withCustomDomain(props: WithCustomDomainProps)                                    │
│  - withWaf(props: WithWafProps)                                                      │
│  - withCustomDomainAndWaf(props: WithCustomDomainAndWafProps)                        │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         DatabaseConstruct                                    │    │
│  │  DynamoDB Table (PK/SK, PAY_PER_REQUEST)                                    │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ table                                          │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          AuthConstruct                                       │    │
│  │  Cognito User Pool + Client (Email sign-in, SRP auth)                       │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ userPool                                       │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           ApiConstruct                                       │    │
│  │  REST API Gateway + Lambda (Node.js 20.x)                                   │    │
│  │  - entry: ユーザー指定のLambdaハンドラー                                     │    │
│  │  - Cognito Authorizer (JWT validation)                                      │    │
│  │  - Resource Policy (custom header restriction)                              │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │ api, customHeaderName, customHeaderSecret      │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         FrontendConstruct                                    │    │
│  │  S3 Bucket + CloudFront Distribution                                        │    │
│  │  - OAC for S3 access                                                        │    │
│  │  - CloudFront Function for SPA routing                                      │    │
│  │  - /api/* behavior for API Gateway                                          │    │
│  │  - カスタムドメイン + 証明書自動発行（オプション）                            │    │
│  │  - WAF WebACL（オプション）                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  Outputs:                                                                            │
│  - distributionDomainName, apiUrl, userPoolId, userPoolClientId, tableName          │
│  - database, auth, api, frontend (construct instances)                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Props設計

### ファクトリメソッド用Props

```typescript
// 最小構成
interface MinimalProps {
  readonly lambdaEntry: string; // 必須
  readonly advanced?: AdvancedOptions; // オプション
}

// カスタムドメイン付き
interface WithCustomDomainProps {
  readonly lambdaEntry: string; // 必須
  readonly domainName: string; // 必須
  readonly hostedZoneId: string; // 必須
  readonly zoneName: string; // 必須
  readonly alternativeDomainNames?: string[]; // オプション
  readonly advanced?: AdvancedOptions; // オプション
}

// WAF付き
interface WithWafProps {
  readonly lambdaEntry: string; // 必須
  readonly ssmPrefix: string; // 必須
  readonly securityRegion?: string; // オプション（デフォルト: us-east-1）
  readonly advanced?: AdvancedOptions; // オプション
}

// フル構成
interface WithCustomDomainAndWafProps {
  readonly lambdaEntry: string; // 必須
  readonly domainName: string; // 必須
  readonly hostedZoneId: string; // 必須
  readonly zoneName: string; // 必須
  readonly ssmPrefix: string; // 必須
  readonly alternativeDomainNames?: string[]; // オプション
  readonly securityRegion?: string; // オプション
  readonly advanced?: AdvancedOptions; // オプション
}
```

### 詳細カスタマイズ用Props

```typescript
interface AdvancedOptions {
  readonly database?: DatabaseConstructProps;
  readonly auth?: AuthConstructProps;
  readonly api?: Omit<ApiConstructProps, 'table' | 'userPool' | 'entry'>;
  readonly frontend?: Omit<
    FrontendConstructProps,
    'api' | 'customHeaderName' | 'customHeaderSecret' | 'webAclArn'
  >;
  readonly security?: SecurityConfig;
  readonly removalPolicy?: RemovalPolicy;
  readonly tags?: { [key: string]: string };
}
```

## デプロイパターン

### パターン1: 最小構成（1スタック）

```typescript
// app.ts
const app = new App();
const stack = new Stack(app, 'MyAppStack');

ServerlessSpa.minimal(stack, 'App', {
  lambdaEntry: './src/api/handler.ts',
});
```

### パターン2: カスタムドメイン（1スタック）

```typescript
// app.ts
const app = new App();
const stack = new Stack(app, 'MyAppStack');

ServerlessSpa.withCustomDomain(stack, 'App', {
  lambdaEntry: './src/api/handler.ts',
  domainName: 'www.example.com',
  hostedZoneId: 'Z1234567890ABC',
  zoneName: 'example.com',
});
```

### パターン3: WAF付き（2スタック）

```typescript
// app.ts
const app = new App();

// 1. SecurityStack (us-east-1)
const securityStack = new Stack(app, 'SecurityStack', {
  env: { region: 'us-east-1' },
});
new ServerlessSpaSecurityConstruct(securityStack, 'Security', {
  ssm: { ssmPrefix: '/myapp/security/' },
});

// 2. MainStack (任意リージョン)
const mainStack = new Stack(app, 'MainStack', {
  env: { region: 'ap-northeast-1' },
});
ServerlessSpa.withWaf(mainStack, 'App', {
  lambdaEntry: './src/api/handler.ts',
  ssmPrefix: '/myapp/security/',
});
```

## 正当性プロパティ

### プロパティ1: ファクトリメソッドによる全コンストラクト作成

_任意の_ ファクトリメソッド呼び出しにおいて、DatabaseConstruct、AuthConstruct、ApiConstruct、FrontendConstructの4つの低レベルコンストラクトが全て作成される。

### プロパティ2: lambdaEntryの透過的転送

_任意の_ ファクトリメソッド呼び出しにおいて、lambdaEntryプロパティはApiConstructのentryプロパティとして正しく渡される。

### プロパティ3: カスタムドメイン設定の透過的転送

_任意の_ withCustomDomainまたはwithCustomDomainAndWaf呼び出しにおいて、domainName、hostedZoneId、zoneName、alternativeDomainNamesはFrontendConstructに正しく渡される。

### プロパティ4: WAF設定の透過的転送

_任意の_ withWafまたはwithCustomDomainAndWaf呼び出しにおいて、ssmPrefixとsecurityRegionはSecurityConfigとして正しく設定される。

### プロパティ5: Advanced Optionsの透過的転送

_任意の_ ファクトリメソッド呼び出しにおいて、advancedプロパティで指定された設定は対応する低レベルコンストラクトに正しく透過的に渡される。

## テスト戦略

### テストケース

1. **ファクトリメソッドテスト**
   - minimal()で全リソースが作成されること
   - withCustomDomain()でカスタムドメイン設定が適用されること
   - withWaf()でセキュリティ設定が適用されること
   - withCustomDomainAndWaf()で両方の設定が適用されること

2. **lambdaEntry透過的転送テスト**
   - 指定されたentryがLambda関数に設定されること

3. **Advanced Options透過的転送テスト**
   - database、auth、api、frontendプロパティが正しく渡されること

4. **出力プロパティテスト**
   - 全ての便利プロパティが正しく公開されること
