# 要件ドキュメント

## はじめに

FrontendConstructは、サーバーレスSPAアプリケーション向けのS3バケットとCloudFrontディストリビューションを作成する低レベルCDKコンストラクトである。Viteでビルドした静的ファイルをホスティングし、CloudFrontをエントリーポイントとして提供する。オプションでAPI Gateway（/api/\*）へのルーティングをサポートし、カスタムヘッダーによるアクセス制限を実現する。OAC（Origin Access Control）を使用してS3への直接アクセスを防ぎ、セキュアな構成を提供する。

## 用語集

- **FrontendConstruct**: S3バケットとCloudFrontディストリビューションを作成するCDKコンストラクト
- **Bucket**: 静的ファイルをホスティングするS3バケットリソース
- **Distribution**: CloudFrontディストリビューションリソース
- **OAC**: Origin Access Control（CloudFrontからS3へのアクセス制御）
- **Behavior**: CloudFrontのキャッシュ動作設定
- **DefaultBehavior**: デフォルトのキャッシュ動作（/\*へのリクエスト）
- **AdditionalBehavior**: 追加のキャッシュ動作（/api/\*へのリクエスト）
- **CustomHeader**: API Gatewayへのリクエストに付与するカスタムヘッダー
- **SPA**: Single Page Application（シングルページアプリケーション）
- **Props**: コンストラクトの設定パラメータ
- **IRestApi**: API Gatewayのインターフェース型

## 要件

### 要件1: S3バケット作成

**ユーザーストーリー:** 開発者として、静的ファイルをホスティングするS3バケットを作成したい。セキュアな設定でCloudFront経由のみアクセス可能にする。

#### 受け入れ基準

1. WHEN FrontendConstructがインスタンス化される THEN THE Bucket SHALL S3バケットを作成する
2. THE Bucket SHALL パブリックアクセスをブロックする（blockPublicAccess: BlockPublicAccess.BLOCK_ALL）
3. THE Bucket SHALL 直接アクセスを禁止する（publicReadAccess: false）
4. THE Bucket SHALL デフォルトでRemovalPolicy.DESTROYを使用する（開発環境向け）
5. THE Bucket SHALL デフォルトでautoDeleteObjects: trueを設定する（スタック削除時にオブジェクトも削除）
6. WHEN bucketPropsが指定される THEN THE Bucket SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件2: CloudFrontディストリビューション作成

**ユーザーストーリー:** 開発者として、CloudFrontディストリビューションを作成したい。CDNとしてグローバルに静的ファイルを配信する。

#### 受け入れ基準

1. WHEN FrontendConstructがインスタンス化される THEN THE Distribution SHALL CloudFrontディストリビューションを作成する
2. THE Distribution SHALL S3バケットをデフォルトオリジンとして設定する
3. THE Distribution SHALL OAC（Origin Access Control）を使用してS3にアクセスする
4. THE Distribution SHALL デフォルトでPriceClass.PRICE_CLASS_100を使用する（コスト最適化）
5. WHEN distributionPropsが指定される THEN THE Distribution SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件3: SPAルーティング

**ユーザーストーリー:** 開発者として、SPAのクライアントサイドルーティングをサポートしたい。拡張子のないパスへのアクセスをindex.htmlにルーティングする。

#### 受け入れ基準

1. THE Distribution SHALL CloudFront Functionsを使用してリクエストURIを書き換える
2. THE CloudFrontFunction SHALL 拡張子のないパス（例: /about, /users/123）をindex.htmlにルーティングする
3. THE CloudFrontFunction SHALL 拡張子のあるパス（例: /assets/style.css, /image.png）はそのまま通過させる
4. THE CloudFrontFunction SHALL ルートパス（/）はindex.htmlにルーティングする
5. THE Distribution SHALL 403エラー時に/index.htmlを返す（ステータスコード200、フォールバック用）
6. THE Distribution SHALL 404エラー時に/index.htmlを返す（ステータスコード200、フォールバック用）
7. THE Distribution SHALL デフォルトルートオブジェクトとしてindex.htmlを設定する

### 要件4: API Gatewayルーティング（オプション）

**ユーザーストーリー:** 開発者として、/api/\*へのリクエストをAPI Gatewayにルーティングしたい。CloudFrontを単一のエントリーポイントとして使用する。

#### 受け入れ基準

1. WHEN apiが指定される THEN THE Distribution SHALL /api/\*パスをAPI Gatewayにルーティングする
2. WHEN apiが指定される THEN THE Distribution SHALL API Gatewayオリジンにカスタムヘッダーを付与する
3. WHEN apiが指定されない THEN THE Distribution SHALL API Gatewayへのルーティングを設定しない
4. THE Distribution SHALL API Gatewayオリジンでキャッシュを無効化する（CachePolicy.CACHING_DISABLED）
5. THE Distribution SHALL API Gatewayオリジンで全てのヘッダーを転送する（OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER）

### 要件5: カスタムヘッダー設定

**ユーザーストーリー:** 開発者として、API Gatewayへのリクエストにカスタムヘッダーを付与したい。CloudFront経由のみAPIにアクセスできるようにする。

#### 受け入れ基準

1. WHEN apiが指定される THEN THE Distribution SHALL カスタムヘッダーをAPI Gatewayオリジンに付与する
2. WHEN customHeaderNameが指定される THEN THE Distribution SHALL 指定されたヘッダー名を使用する
3. WHEN customHeaderNameが指定されない THEN THE Distribution SHALL デフォルトで'x-origin-verify'を使用する
4. WHEN customHeaderSecretが指定される THEN THE Distribution SHALL 指定されたシークレット値を使用する
5. WHEN customHeaderSecretが指定されない THEN THE Distribution SHALL ランダムなUUIDを生成して使用する

### 要件6: リソース参照の公開

**ユーザーストーリー:** 開発者として、作成されたバケットとディストリビューションを他のコンストラクトから参照したい。ServerlessSpaコンストラクトから利用するために必要である。

#### 受け入れ基準

1. THE FrontendConstruct SHALL bucketプロパティとしてIBucket型のバケット参照を公開する
2. THE FrontendConstruct SHALL distributionプロパティとしてIDistribution型のディストリビューション参照を公開する
3. THE FrontendConstruct SHALL distributionDomainNameプロパティとしてディストリビューションのドメイン名を公開する
4. WHEN apiが指定される THEN THE FrontendConstruct SHALL customHeaderNameプロパティを公開する
5. WHEN apiが指定される THEN THE FrontendConstruct SHALL customHeaderSecretプロパティを公開する

### 要件7: 削除ポリシー

**ユーザーストーリー:** 開発者として、開発環境で簡単にリソースをクリーンアップしたい。

#### 受け入れ基準

1. THE Bucket SHALL デフォルトでRemovalPolicy.DESTROYを使用する
2. THE Bucket SHALL デフォルトでautoDeleteObjects: trueを設定する
3. WHEN bucketPropsでremovalPolicyが指定される THEN THE Bucket SHALL 指定された削除ポリシーを使用する
