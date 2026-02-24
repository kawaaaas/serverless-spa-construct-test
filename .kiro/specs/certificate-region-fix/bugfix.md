# バグ修正要件ドキュメント

## はじめに

CloudFrontディストリビューションにカスタムドメインを設定する際、FrontendConstructがACM証明書をメインスタックのリージョン（例: ap-northeast-1）で自動作成してしまう。CloudFrontはus-east-1リージョンの証明書のみを受け付けるため、デプロイが以下のエラーで失敗する:

```
Invalid request provided: AWS::CloudFront::Distribution: The specified SSL certificate doesn't exist, isn't in us-east-1 region, isn't valid, or doesn't include a valid certificate chain.
```

このバグは`ServerlessSpaConstruct.withCustomDomain()`および`ServerlessSpaConstruct.withCustomDomainAndWaf()`のファクトリメソッドを使用した場合に発生する。

修正方針: CloudFrontが必要とするus-east-1リソース（ACM証明書）はセキュリティスタック（us-east-1）で作成し、既存のクロスリージョンパターン（ServerlessSpaSecurityConstruct + SSM + factory method）に従ってメインスタックに共有する。具体的には:

1. 新しいCertificateConstructをus-east-1セキュリティスタックに作成
2. ServerlessSpaSecurityConstructに`withCertificate`/`withWafAndCertificate`のfactory methodを追加
3. 証明書ARNをSSMパラメータ経由でメインリージョンに共有
4. メインスタックのServerlessSpaConstructがSSMから証明書ARNを取得し、FrontendConstructのCloudFrontに適用
5. FrontendConstructの自前証明書作成ロジックを削除

## バグ分析

### 現在の動作（不具合）

1.1 WHEN `ServerlessSpaConstruct.withCustomDomain()`でdomainName、hostedZoneId、zoneNameを指定してデプロイする THEN FrontendConstructがメインスタックのリージョン（例: ap-northeast-1）でACM証明書を作成し、CloudFrontがus-east-1の証明書を要求するためデプロイが`Invalid request provided: The specified SSL certificate doesn't exist, isn't in us-east-1 region`エラーで失敗する

1.2 WHEN `ServerlessSpaConstruct.withCustomDomainAndWaf()`でdomainName、hostedZoneId、zoneNameを指定してデプロイする THEN FrontendConstructがメインスタックのリージョン（例: ap-northeast-1）でACM証明書を作成し、CloudFrontがus-east-1の証明書を要求するためデプロイが同様のリージョン不一致エラーで失敗する

1.3 WHEN FrontendConstructにdomainNameとhostedZoneId/zoneNameを渡すが、certificateを渡さない THEN FrontendConstructが現在のスタックリージョンで`new Certificate()`を実行し、us-east-1以外のリージョンでは無効な証明書が作成される

### 期待される動作（正しい動作）

2.1 WHEN `ServerlessSpaSecurityConstruct.withCertificate()`でdomainName、hostedZoneId、zoneNameを指定してus-east-1にデプロイする THEN CertificateConstructがus-east-1でACM証明書を作成し、証明書ARNがSSMパラメータ（`{ssmPrefix}certificate-arn`）に保存される

2.2 WHEN `ServerlessSpaSecurityConstruct.withWafAndCertificate()`でdomainName、hostedZoneId、zoneName、rateLimitを指定してus-east-1にデプロイする THEN CertificateConstructがus-east-1でACM証明書を作成し、WAFと共に証明書ARNがSSMパラメータに保存される

2.3 WHEN メインスタックのServerlessSpaConstruct（withCustomDomainまたはwithCustomDomainAndWaf）がセキュリティスタックのSSMから証明書ARNを取得する THEN AwsCustomResource経由でus-east-1のSSMパラメータから証明書ARNを取得し、Certificate.fromCertificateArnでICertificateに変換してFrontendConstructに渡し、CloudFrontディストリビューションに正しく適用されてデプロイが成功する

2.4 WHEN FrontendConstructにdomainNameを渡すがcertificateを渡さない THEN FrontendConstructがバリデーションエラーをスローし、証明書が外部から注入される必要があることを明示する

### 変更されない動作（リグレッション防止）

3.1 WHEN `ServerlessSpaConstruct.minimal()`でdomainNameを指定せずにデプロイする THEN CloudFrontデフォルトドメインで正常にデプロイが成功し続ける

3.2 WHEN `ServerlessSpaConstruct.withWaf()`でdomainNameを指定せずにデプロイする THEN WAF保護付きでCloudFrontデフォルトドメインで正常にデプロイが成功し続ける

3.3 WHEN FrontendConstructにdomainNameとcertificate（外部作成済みのus-east-1証明書）を両方渡す THEN 提供された証明書がCloudFrontディストリビューションに正しく適用され続ける

3.4 WHEN ServerlessSpaSecurityConstructの既存ファクトリメソッド（minimal、withWaf）を使用する THEN WAF、Secret、Lambda@Edge、SSMパラメータが従来通り正しく作成・共有され続ける

3.5 WHEN セキュリティスタックのSSMパラメータ（waf-acl-arn、custom-header-name、secret-arn、edge-function-version-arn）をメインスタックから取得する THEN 既存のAwsCustomResource経由のクロスリージョン取得が正常に動作し続ける
