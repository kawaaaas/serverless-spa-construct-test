# 実装計画: FrontendConstruct

## 概要

S3バケットとCloudFrontディストリビューションを作成する低レベルCDKコンストラクトを実装する。CloudFront Functionsを使用したSPAルーティングをサポートし、オプションでAPI Gatewayへのルーティングを提供する。

## タスク

- [x] 1. FrontendConstructの基本実装
  - [x] 1.1 FrontendConstructPropsインターフェースを定義する
    - api?: IRestApi（オプション）
    - customHeaderName?: string（デフォルト: 'x-origin-verify'）
    - customHeaderSecret?: string（デフォルト: UUID生成）
    - bucketProps?: Partial<BucketProps>
    - distributionProps?: Partial<DistributionProps>
    - JSDocコメントでデフォルト値を明記
    - _要件: 1.6, 2.5, 4.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 1.2 FrontendConstructクラスの基本構造を実装する
    - Constructを継承
    - 公開プロパティ: bucket, distribution, distributionDomainName, customHeaderName?, customHeaderSecret?
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. S3バケットの実装
  - [x] 2.1 S3バケットを作成する
    - BlockPublicAccess.BLOCK_ALL
    - publicReadAccess: false
    - RemovalPolicy.DESTROY（デフォルト）
    - autoDeleteObjects: true（デフォルト）
    - bucketPropsによる上書き機能
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2, 7.3_

- [x] 3. CloudFront Functionの実装
  - [x] 3.1 SPAルーティング用CloudFront Functionを作成する
    - 拡張子なしパス → /index.htmlに書き換え
    - 拡張子ありパス → そのまま通過
    - viewer-requestイベントで実行
    - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 4. CloudFrontディストリビューションの実装
  - [x] 4.1 S3オリジンとOACを設定する
    - S3BucketOriginWithOACを使用
    - OACを自動作成
    - _要件: 2.2, 2.3_
  - [x] 4.2 デフォルトビヘイビアを設定する
    - CloudFront Functionを関連付け
    - PriceClass.PRICE_CLASS_100
    - defaultRootObject: 'index.html'
    - _要件: 2.1, 2.4, 3.7_
  - [x] 4.3 エラーレスポンスを設定する
    - 403 → /index.html (200)
    - 404 → /index.html (200)
    - _要件: 3.5, 3.6_
  - [x] 4.4 distributionPropsによる上書き機能を実装する
    - _要件: 2.5_

- [x] 5. API Gatewayルーティングの実装（オプション）
  - [x] 5.1 API Gateway オリジンを設定する（api指定時のみ）
    - HttpOriginを使用
    - カスタムヘッダーを付与
    - _要件: 4.1, 4.2, 5.1_
  - [x] 5.2 /api/\*ビヘイビアを追加する（api指定時のみ）
    - CachePolicy.CACHING_DISABLED
    - OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
    - _要件: 4.4, 4.5_
  - [x] 5.3 カスタムヘッダー設定を実装する
    - デフォルト: 'x-origin-verify'
    - デフォルト: UUID生成
    - 指定時は指定値を使用
    - _要件: 5.2, 5.3, 5.4, 5.5_

- [x] 6. チェックポイント - 実装確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 7. ユニットテスト実装
  - [x] 7.1 S3バケットテストを実装する
    - S3バケットが作成されること
    - パブリックアクセスがブロックされること
    - RemovalPolicy.DESTROYが設定されること
    - autoDeleteObjectsが有効であること
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 7.2 CloudFrontディストリビューションテストを実装する
    - ディストリビューションが作成されること
    - OACが作成・関連付けされること
    - PriceClass.PRICE_CLASS_100が設定されること
    - エラーレスポンスが設定されること
    - デフォルトルートオブジェクトがindex.htmlであること
    - _要件: 2.1, 2.2, 2.3, 2.4, 3.5, 3.6, 3.7_
  - [x] 7.3 CloudFront Functionテストを実装する
    - CloudFront Functionが作成されること
    - デフォルトビヘイビアに関連付けられること
    - _要件: 3.1_
  - [x] 7.4 API Gatewayルーティングテストを実装する
    - api指定時に/api/\*ビヘイビアが追加されること
    - api未指定時にビヘイビアが存在しないこと
    - カスタムヘッダーが設定されること
    - _要件: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 7.5 カスタムヘッダーテストを実装する
    - デフォルトヘッダー名が使用されること
    - カスタムヘッダー名・シークレットが指定できること
    - _要件: 5.2, 5.3, 5.4, 5.5_
  - [x] 7.6 Props上書きテストを実装する
    - bucketPropsでデフォルト設定が上書きされること
    - distributionPropsでデフォルト設定が上書きされること
    - _要件: 1.6, 2.5_
  - [x] 7.7 出力プロパティテストを実装する
    - bucket, distribution, distributionDomainNameが公開されること
    - api指定時にcustomHeaderName, customHeaderSecretが公開されること
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. エクスポート設定
  - [x] 8.1 lib/index.tsにFrontendConstructをエクスポートする
    - FrontendConstruct, FrontendConstructPropsをエクスポート

- [x] 9. 最終チェックポイント
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

## 備考

- 実装言語: TypeScript
- テストフレームワーク: Jest + CDK Assertions
- ファイル配置:
  - lib/constructs/frontend-construct.ts
  - test/constructs/frontend-construct.test.ts
