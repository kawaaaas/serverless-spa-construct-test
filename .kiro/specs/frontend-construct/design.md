# 設計ドキュメント

## 概要

FrontendConstructは、S3バケットとCloudFrontディストリビューションを作成する低レベルCDKコンストラクトである。Viteでビルドした静的ファイルをホスティングし、CloudFrontをエントリーポイントとして提供する。OAC（Origin Access Control）を使用してS3への直接アクセスを防ぎ、CloudFront Functionsを使用してSPAのクライアントサイドルーティングをサポートする。オプションでAPI Gateway（/api/\*）へのルーティングをサポートし、カスタムヘッダーによるアクセス制限を実現する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FrontendConstruct                                      │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                    CloudFront Distribution                                 │  │
│  │                                                                            │  │
│  │  PriceClass: PRICE_CLASS_100 (default)                                    │  │
│  │  DefaultRootObject: index.html                                            │  │
│  │                                                                            │  │
│  │  Error Responses:                                                         │  │
│  │  - 403 → /index.html (200)                                                │  │
│  │  - 404 → /index.html (200)                                                │  │
│  │                                                                            │  │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Default Behavior (/*) → S3 Origin                                 │  │  │
│  │  │                                                                    │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────────┐│  │  │
│  │  │  │  CloudFront Function (viewer-request)                        ││  │  │
│  │  │  │  - /about → /index.html                                      ││  │  │
│  │  │  │  - /users/123 → /index.html                                  ││  │  │
│  │  │  │  - /assets/style.css → /assets/style.css (pass through)     ││  │  │
│  │  │  └──────────────────────────────────────────────────────────────┘│  │  │
│  │  │                                                                    │  │  │
│  │  │  OAC (Origin Access Control)                                       │  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                            │  │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Additional Behavior (/api/*) → API Gateway Origin (Optional)      │  │  │
│  │  │                                                                    │  │  │
│  │  │  Custom Headers:                                                   │  │  │
│  │  │  - x-origin-verify: <secret>                                       │  │  │
│  │  │                                                                    │  │  │
│  │  │  CachePolicy: CACHING_DISABLED                                     │  │  │
│  │  │  OriginRequestPolicy: ALL_VIEWER_EXCEPT_HOST_HEADER               │  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                           │                                                      │
│                           │ OAC                                                  │
│                           ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         S3 Bucket                                          │  │
│  │                                                                            │  │
│  │  BlockPublicAccess: BLOCK_ALL                                             │  │
│  │  PublicReadAccess: false                                                  │  │
│  │  RemovalPolicy: DESTROY (default)                                         │  │
│  │  AutoDeleteObjects: true (default)                                        │  │
│  │                                                                            │  │
│  │  Bucket Policy: Allow CloudFront OAC only                                 │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Outputs:                                                                        │
│  - bucket: IBucket                                                               │
│  - distribution: IDistribution                                                   │
│  - distributionDomainName: string                                                │
│  - customHeaderName?: string (when api is provided)                              │
│  - customHeaderSecret?: string (when api is provided)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## コンポーネントとインターフェース

### FrontendConstructProps

```typescript
import { BucketProps } from 'aws-cdk-lib/aws-s3';
import { DistributionProps } from 'aws-cdk-lib/aws-cloudfront';
import { IRestApi } from 'aws-cdk-lib/aws-apigateway';

export interface FrontendConstructProps {
  /**
   * Optional API Gateway for /api/* routing.
   * If provided, requests to /api/* will be routed to this API Gateway.
   */
  readonly api?: IRestApi;

  /**
   * Custom header name for API Gateway access restriction.
   * Only used when api is provided.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Custom header secret value for API Gateway access restriction.
   * Only used when api is provided.
   * If not provided, a random UUID will be generated.
   */
  readonly customHeaderSecret?: string;

  /**
   * Additional S3 bucket properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly bucketProps?: Partial<BucketProps>;

  /**
   * Additional CloudFront distribution properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly distributionProps?: Partial<DistributionProps>;
}
```

### FrontendConstruct クラス

```typescript
import { Construct } from 'constructs';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { IDistribution, Distribution } from 'aws-cdk-lib/aws-cloudfront';

export class FrontendConstruct extends Construct {
  /**
   * The S3 bucket created by this construct.
   */
  public readonly bucket: IBucket;

  /**
   * The CloudFront distribution created by this construct.
   */
  public readonly distribution: IDistribution;

  /**
   * The domain name of the CloudFront distribution.
   */
  public readonly distributionDomainName: string;

  /**
   * The custom header name used for API Gateway access restriction.
   * Only available when api is provided.
   */
  public readonly customHeaderName?: string;

  /**
   * The custom header secret value used for API Gateway access restriction.
   * Only available when api is provided.
   */
  public readonly customHeaderSecret?: string;

  constructor(scope: Construct, id: string, props?: FrontendConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

### CloudFront Function コード

```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Check if the URI has a file extension
  if (uri.includes('.')) {
    // Has extension, pass through (e.g., /assets/style.css, /image.png)
    return request;
  }

  // No extension, route to index.html for SPA routing
  // e.g., /about, /users/123, /
  request.uri = '/index.html';
  return request;
}
```

## データモデル

### デフォルト設定値

#### S3バケット

| 設定項目          | デフォルト値                | 理由                               |
| ----------------- | --------------------------- | ---------------------------------- |
| blockPublicAccess | BlockPublicAccess.BLOCK_ALL | セキュリティベストプラクティス     |
| publicReadAccess  | false                       | CloudFront経由のみアクセス可能     |
| removalPolicy     | RemovalPolicy.DESTROY       | 開発環境での迅速なクリーンアップ   |
| autoDeleteObjects | true                        | スタック削除時にオブジェクトも削除 |

#### CloudFrontディストリビューション

| 設定項目             | デフォルト値               | 理由                            |
| -------------------- | -------------------------- | ------------------------------- |
| priceClass           | PriceClass.PRICE_CLASS_100 | コスト最適化（北米・欧州のみ）  |
| defaultRootObject    | 'index.html'               | SPAのエントリーポイント         |
| errorResponses (403) | /index.html (200)          | SPAルーティングのフォールバック |
| errorResponses (404) | /index.html (200)          | SPAルーティングのフォールバック |

#### API Gatewayオリジン（オプション）

| 設定項目            | デフォルト値                                      | 理由                            |
| ------------------- | ------------------------------------------------- | ------------------------------- |
| cachePolicy         | CachePolicy.CACHING_DISABLED                      | APIレスポンスはキャッシュしない |
| originRequestPolicy | OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER | 全ヘッダーを転送（認証用）      |
| customHeaderName    | 'x-origin-verify'                                 | API Gateway制限用の標準的な名前 |
| customHeaderSecret  | UUID v4                                           | セキュアなランダム値            |

### CloudFront Function ロジック

| URIパターン    | 処理                  | 例                                    |
| -------------- | --------------------- | ------------------------------------- |
| 拡張子あり     | そのまま通過          | /assets/style.css → /assets/style.css |
| 拡張子なし     | /index.htmlに書き換え | /about → /index.html                  |
| ルートパス     | /index.htmlに書き換え | / → /index.html                       |
| ネストしたパス | /index.htmlに書き換え | /users/123 → /index.html              |

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: S3バケットセキュリティ設定

_任意の_ FrontendConstructインスタンスにおいて、作成されるS3バケットはパブリックアクセスが完全にブロックされ（BlockPublicAccess.BLOCK_ALL）、直接のパブリック読み取りアクセスが禁止されている。

**検証対象: 要件 1.2, 1.3**

### プロパティ2: S3バケットデフォルト削除ポリシー

_任意の_ FrontendConstructインスタンスにおいて、bucketPropsで上書きされない限り、S3バケットはRemovalPolicy.DESTROYが設定され、autoDeleteObjectsがtrueに設定される。

**検証対象: 要件 1.4, 1.5, 7.1, 7.2**

### プロパティ3: bucketProps上書き

_任意の_ bucketProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。

**検証対象: 要件 1.6, 7.3**

### プロパティ4: CloudFront OAC設定

_任意の_ FrontendConstructインスタンスにおいて、CloudFrontディストリビューションはOAC（Origin Access Control）を使用してS3バケットにアクセスし、S3バケットポリシーはCloudFront OACからのアクセスのみを許可する。

**検証対象: 要件 2.3**

### プロパティ5: CloudFrontデフォルトPriceClass

_任意の_ FrontendConstructインスタンスにおいて、distributionPropsで上書きされない限り、CloudFrontディストリビューションはPriceClass.PRICE_CLASS_100を使用する。

**検証対象: 要件 2.4**

### プロパティ6: distributionProps上書き

_任意の_ distributionProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。

**検証対象: 要件 2.5**

### プロパティ7: CloudFront Function SPAルーティング

_任意の_ URIにおいて、CloudFront Functionは拡張子のないパス（/about, /users/123等）を/index.htmlに書き換え、拡張子のあるパス（/assets/style.css等）はそのまま通過させる。

**検証対象: 要件 3.1, 3.2, 3.3, 3.4**

### プロパティ8: CloudFrontエラーレスポンス

_任意の_ FrontendConstructインスタンスにおいて、CloudFrontディストリビューションは403および404エラー時に/index.htmlをステータスコード200で返す。

**検証対象: 要件 3.5, 3.6**

### プロパティ9: CloudFrontデフォルトルートオブジェクト

_任意の_ FrontendConstructインスタンスにおいて、CloudFrontディストリビューションのデフォルトルートオブジェクトはindex.htmlに設定される。

**検証対象: 要件 3.7**

### プロパティ10: API Gatewayルーティング（api指定時）

_任意の_ FrontendConstructインスタンスにおいて、apiが指定された場合、/api/\*パスはAPI Gatewayにルーティングされ、カスタムヘッダーが付与され、キャッシュが無効化され、全ヘッダーが転送される。

**検証対象: 要件 4.1, 4.2, 4.4, 4.5, 5.1**

### プロパティ11: API Gatewayルーティングなし（api未指定時）

_任意の_ FrontendConstructインスタンスにおいて、apiが指定されない場合、API Gatewayへのルーティング設定は存在しない。

**検証対象: 要件 4.3**

### プロパティ12: カスタムヘッダー設定

_任意の_ FrontendConstructインスタンスにおいて、apiが指定された場合、customHeaderNameはデフォルトで'x-origin-verify'を使用し、customHeaderSecretはデフォルトでランダムなUUIDを生成する。指定された場合は指定値を使用する。

**検証対象: 要件 5.2, 5.3, 5.4, 5.5**

### プロパティ13: 出力プロパティ公開

_任意の_ FrontendConstructインスタンスにおいて、bucket、distribution、distributionDomainNameプロパティが正しく公開され、作成されたリソースの情報と一致する。apiが指定された場合は、customHeaderNameとcustomHeaderSecretも公開される。

**検証対象: 要件 6.1, 6.2, 6.3, 6.4, 6.5**

## エラーハンドリング

### バリデーション

FrontendConstructは以下のバリデーションを行う：

1. **api指定時のカスタムヘッダー整合性**: apiが指定されていない場合、customHeaderNameとcustomHeaderSecretは無視される
2. **Props型チェック**: CDKの型システムによる自動検証

### エラーメッセージ

CDKの標準的なバリデーションエラーメッセージを使用する。カスタムバリデーションは最小限に抑え、CDKの既存機能を活用する。

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

### テストケース

1. **S3バケット作成テスト**
   - S3バケットリソースが作成されること
   - パブリックアクセスがブロックされること
   - RemovalPolicy.DESTROYが設定されること
   - autoDeleteObjectsが有効であること

2. **CloudFrontディストリビューション作成テスト**
   - CloudFrontディストリビューションが作成されること
   - S3オリジンが設定されること
   - OACが作成・関連付けされること
   - PriceClass.PRICE_CLASS_100が設定されること

3. **SPAルーティングテスト**
   - CloudFront Functionが作成されること
   - 403/404エラーレスポンスが設定されること
   - デフォルトルートオブジェクトがindex.htmlであること

4. **CloudFront Function ロジックテスト**
   - 拡張子なしパスがindex.htmlに書き換えられること
   - 拡張子ありパスがそのまま通過すること
   - ルートパスがindex.htmlに書き換えられること

5. **API Gatewayルーティングテスト（api指定時）**
   - /api/\*ビヘイビアが追加されること
   - カスタムヘッダーが設定されること
   - キャッシュが無効化されること

6. **API Gatewayルーティングなしテスト（api未指定時）**
   - /api/\*ビヘイビアが存在しないこと

7. **カスタムヘッダーテスト**
   - デフォルトヘッダー名が使用されること
   - カスタムヘッダー名・シークレットが指定できること

8. **Props上書きテスト**
   - bucketPropsでデフォルト設定が上書きされること
   - distributionPropsでデフォルト設定が上書きされること

9. **出力テスト**
   - bucket、distribution、distributionDomainNameが正しく公開されること
   - api指定時にcustomHeaderName、customHeaderSecretが公開されること

### テストファイル構成

```
test/
└── constructs/
    └── frontend-construct.test.ts
```

### テスト実装例

```typescript
import { App, Stack } from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { FrontendConstruct } from '../../lib/constructs/frontend-construct';

describe('FrontendConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('S3 Bucket', () => {
    test('creates S3 bucket with public access blocked', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('creates S3 bucket with DESTROY removal policy', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });
  });

  describe('CloudFront Distribution', () => {
    test('creates CloudFront distribution with PRICE_CLASS_100', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          PriceClass: 'PriceClass_100',
        },
      });
    });

    test('creates CloudFront distribution with OAC', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    });

    test('creates CloudFront distribution with error responses', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({
              ErrorCode: 403,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
            Match.objectLike({
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
          ]),
        },
      });
    });

    test('creates CloudFront Function for SPA routing', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::Function', 1);
    });
  });

  describe('API Gateway Routing', () => {
    test('adds /api/* behavior when api is provided', () => {
      const api = new RestApi(stack, 'TestApi');
      new FrontendConstruct(stack, 'Frontend', { api });

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

    test('does not add /api/* behavior when api is not provided', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.absent(),
        },
      });
    });
  });

  describe('Custom Header', () => {
    test('uses default custom header name', () => {
      const api = new RestApi(stack, 'TestApi');
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderName).toBe('x-origin-verify');
    });

    test('uses custom header name when provided', () => {
      const api = new RestApi(stack, 'TestApi');
      const frontend = new FrontendConstruct(stack, 'Frontend', {
        api,
        customHeaderName: 'x-custom-header',
      });

      expect(frontend.customHeaderName).toBe('x-custom-header');
    });
  });

  describe('Outputs', () => {
    test('exposes bucket, distribution, distributionDomainName', () => {
      const frontend = new FrontendConstruct(stack, 'Frontend');

      expect(frontend.bucket).toBeDefined();
      expect(frontend.distribution).toBeDefined();
      expect(frontend.distributionDomainName).toBeDefined();
    });

    test('exposes customHeaderName and customHeaderSecret when api is provided', () => {
      const api = new RestApi(stack, 'TestApi');
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderName).toBeDefined();
      expect(frontend.customHeaderSecret).toBeDefined();
    });
  });
});
```
