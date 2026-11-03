# @forja/android (TWA)

App Android da Play Store que abre o app web (https://habitualfit.zubion.com.br)
em tela cheia, via Trusted Web Activity. Gerado com o Bubblewrap a partir do
`manifest.webmanifest` em produção. É provisório: o app Expo (`apps/mobile`)
vai substituí-lo na mesma página da loja (mesmo `com.habitualfit.myapp`).

## Segredos (fora do git)

- `android.keystore`: a chave de upload (alias `upload`).
- `keystore.env`: a senha da chave.

Guarde uma cópia dos dois num lugar seguro (gerenciador de senhas). Se perder,
dá para pedir a troca da chave de upload no Play Console, mas isso demora alguns dias.

## Build

Pré-requisitos: JDK 17 e Android SDK em `~/.bubblewrap` (ver `~/.bubblewrap/config.json`).

```sh
cd apps/android
export JAVA_HOME=~/.bubblewrap/jdk-17.0.20.1+1
echo "sdk.dir=$HOME/.bubblewrap/android_sdk" > local.properties
./gradlew bundleRelease
source keystore.env
cp app/build/outputs/bundle/release/app-release.aab app-release-bundle.aab
$JAVA_HOME/bin/jarsigner -keystore android.keystore \
  -storepass "$BUBBLEWRAP_KEYSTORE_PASSWORD" app-release-bundle.aab upload
```

O arquivo enviado à Play é o `app-release-bundle.aab`. Antes de cada envio, aumente
`versionCode` e `versionName` em `app/build.gradle` e em `twa-manifest.json`.

## Verificação do domínio

`apps/web/public/.well-known/assetlinks.json` precisa listar o SHA-256 da chave de
**upload** e o da chave da **Play App Signing**. O segundo aparece no Play Console,
em Configuração › Integridade do app, depois do primeiro envio. Se faltar um deles,
o app abre com a barra de endereço do Chrome no topo.
