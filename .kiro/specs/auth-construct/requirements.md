# 要件ドキュメント

## はじめに

AuthConstructは、サーバーレスSPAアプリケーション向けのCognito User Poolを作成する低レベルCDKコンストラクトである。個人開発者向けにコスト最適化されたLiteティアをデフォルトで使用し、SPA認証に最適化された設定を提供する。フロントエンドでJWTトークンを取得してAPI Gatewayで検証する認証フローをサポートする。他のコンストラクトから独立して使用可能であり、Propsによる柔軟なカスタマイズをサポートする。

## 用語集

- **AuthConstruct**: Cognito User Poolを作成するCDKコンストラクト
- **UserPool**: AWS Cognito User Poolリソース
- **UserPoolClient**: User Poolに接続するアプリケーションクライアント
- **JWT**: JSON Web Token（認証トークン）
- **SPA**: Single Page Application（シングルページアプリケーション）
- **Props**: コンストラクトの設定パラメータ
- **SelfSignUp**: ユーザーが自分でアカウントを作成できる機能
- **Liteティア**: Cognito User Poolの低コストティア（10,000 MAU無料、以降$0.0025/MAU）

## 要件

### 要件1: User Pool作成

**ユーザーストーリー:** 開発者として、Cognito User Poolを簡単に作成したい。最小限の設定でSPA認証に適したUser Poolをデプロイできるようにする。

#### 受け入れ基準

1. WHEN AuthConstructがインスタンス化される THEN THE UserPool SHALL Cognito User Poolを作成する
2. THE UserPool SHALL デフォルトでセルフサインアップを有効にする
3. THE UserPool SHALL デフォルトでメールアドレスをサインインエイリアスとして使用する
4. THE UserPool SHALL デフォルトでメールアドレスによる検証を有効にする
5. WHEN userPoolPropsが指定される THEN THE UserPool SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件2: User Pool Client作成

**ユーザーストーリー:** 開発者として、SPAから認証できるUser Pool Clientを作成したい。クライアントシークレットなしでJWTトークンを取得できるようにする。

#### 受け入れ基準

1. WHEN AuthConstructがインスタンス化される THEN THE UserPoolClient SHALL User Pool Clientを作成する
2. THE UserPoolClient SHALL クライアントシークレットを生成しない（SPA向け設定）
3. THE UserPoolClient SHALL USER_SRP_AUTH認証フローをサポートする
4. THE UserPoolClient SHALL ALLOW_REFRESH_TOKEN_AUTH認証フローをサポートする
5. WHEN userPoolClientPropsが指定される THEN THE UserPoolClient SHALL 指定されたプロパティでデフォルト設定を上書きする

### 要件3: コスト最適化（Liteティア）

**ユーザーストーリー:** 個人開発者として、最小限のコストでCognito認証を利用したい。デフォルト設定でコスト最適化された構成になるようにする。

#### 受け入れ基準

1. THE UserPool SHALL デフォルトでLiteティアを使用する（Essentialsティアは使用しない）
2. THE UserPool SHALL パスキー（WebAuthn）認証を使用しない（Essentialsティアが必要なため）
3. THE UserPool SHALL 高度なセキュリティ機能を使用しない（追加コストが発生するため）

### 要件4: パスワードポリシー

**ユーザーストーリー:** 開発者として、セキュアなパスワードポリシーを設定したい。適切なセキュリティレベルを維持しつつ、ユーザーフレンドリーな設定にする。

#### 受け入れ基準

1. THE UserPool SHALL デフォルトで最小パスワード長を8文字に設定する
2. THE UserPool SHALL デフォルトで小文字を必須とする
3. THE UserPool SHALL デフォルトで数字を必須とする
4. WHEN userPoolPropsでpasswordPolicyが指定される THEN THE UserPool SHALL 指定されたパスワードポリシーを使用する

### 要件5: リソース参照の公開

**ユーザーストーリー:** 開発者として、作成されたUser PoolとClientを他のコンストラクトから参照したい。ApiConstructでCognito Authorizerを設定するために必要である。

#### 受け入れ基準

1. THE AuthConstruct SHALL userPoolプロパティとしてIUserPool型のUser Pool参照を公開する
2. THE AuthConstruct SHALL userPoolClientプロパティとしてIUserPoolClient型のClient参照を公開する
3. THE AuthConstruct SHALL userPoolIdプロパティとしてUser Pool IDを公開する
4. THE AuthConstruct SHALL userPoolClientIdプロパティとしてClient IDを公開する

### 要件6: 削除ポリシー

**ユーザーストーリー:** 開発者として、スタックレベルで削除ポリシーを一括管理したい。

#### 受け入れ基準

1. THE AuthConstruct SHALL 削除ポリシーを明示的に設定しない（スタックレベルで一括管理）
2. THE UserPool SHALL CDKのデフォルト動作に従う（スタックの設定を継承）
