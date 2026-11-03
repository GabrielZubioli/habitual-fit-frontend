# @forja/mobile

App Expo (React Native) do Habitual Fit — destino de publicação nas lojas.

## Stack

- **Expo SDK 57** + **Expo Router** (navegação file-based, `app/`).
- **NativeWind 4** (Tailwind em RN) com as cores do web, geradas do
  `styles.css` por `npm run tokens:mobile` (claro/escuro, escuro por padrão).
- **@forja/domain** — lógica de negócio pura compartilhada com o web.
- **@forja/app-core** — as mesmas consultas Supabase (`data/`) e utilitários do
  web. `src/lib/supabase.ts` registra o cliente com `configureSupabase()`.
- **Supabase** — auth e dados, direto (como o web). O PowerSync (offline) volta
  na fase 8 de `docs/migracao-expo.md`.

## Primeiro setup (ambiente de dev)

> Pré-requisito: este pacote está no monorepo. Rode `npm install` na **raiz** uma
> vez. Depois, dentro de `apps/mobile`, fixe as versões nativas alinhadas ao SDK:

```sh
cd apps/mobile
npx expo install --fix     # alinha react-native, expo-*, reanimated etc. ao SDK 57
cp .env.example .env        # preencha as chaves
npm run android            # compila o app nativo e abre no emulador/aparelho
```

Rodar em device/simulador exige Xcode (iOS) ou Android Studio. A primeira build
nativa usa `npx expo run:ios` / `run:android` (New Architecture habilitada).

## Estrutura

```
app/                 # rotas (Expo Router)
  _layout.tsx        # shell: providers (tema, safe area, gestures)
  index.tsx          # tela de verificação do scaffold (temporária)
src/
  theme/theme.tsx    # tema (escuro padrão) + override manual; aplica as cores
  theme/tokens.gen.json  # cores do web (gerado; não editar)
  lib/supabase.ts    # cliente Supabase para RN, registrado no app-core
tailwind.config.js   # cores e raios iguais aos do web
metro.config.js      # resolução de workspace (monorepo) + NativeWind
```

## Próximos passos

O plano completo, com o andamento, está em `docs/migracao-expo.md`.

## Notas

- `app/index.tsx` é a porta de entrada: o questionário para quem chega, o
  Início para quem já tem plano.
- O adaptador de sessão em `src/lib/supabase.ts` usa SecureStore; trocar por
  LargeSecureStore antes de produção (limite de 2 KB) — ver comentário no arquivo.

## Login com Google

Nativo (`@react-native-google-signin/google-signin`): o Android mostra a escolha
de conta, o Google devolve um ID token para o cliente **web**
(`GOOGLE_WEB_CLIENT_ID` em `app-core/lib/google.ts`) e o Supabase abre a sessão
com `signInWithIdToken`, como no web.

O Google só aceita o app se o par pacote + SHA-1 de quem assinou o APK estiver
num cliente OAuth **Android** do mesmo projeto do Google Cloud. Sem isso, o
login falha com `DEVELOPER_ERROR`. Um cliente por chave, todos com o pacote
`com.habitualfit.myapp`:

| Chave                                      | SHA-1                                                         | Onde vale                          |
| ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------- |
| debug (`android/app/debug.keystore`)       | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | emulador, `expo run:android`       |
| upload (`apps/android/android.keystore`)   | `27:98:E1:22:B4:D4:98:FF:C6:A4:9F:56:1E:5F:E4:EF:DD:2C:3F:5C` | APK instalado direto (EAS preview) |
| assinatura da Play (`deployment_cert.der`) | `D9:04:CC:B9:AE:AB:EC:5B:82:EB:9F:2A:FB:48:82:CA:75:02:25:52` | instalado pela Play Store          |

Os três clientes Android já existem no projeto `eternal-ship-512614-i4`
(o mesmo do cliente web). O certificado da Play é baixado no Play Console, na
página "Protegido com o Google Play".

O SHA-1 de uma chave: `keytool -list -v -keystore <arquivo>` (o de upload sai
sem senha com `keytool -printcert -jarfile apps/android/app-release-signed.apk`).

O plugin do pacote no `app.json` só é preciso para o iOS (pede o
`iosUrlScheme` de um cliente iOS); no Android ele não entra.

## Publicar na Play Store

O app nativo substitui o TWA (`apps/android`) **na mesma página da loja**: mesmo
pacote (`com.habitualfit.myapp`) e mesma chave de upload. Assim as instalações
e avaliações continuam.

1. Conta Expo: `npx eas-cli@latest login` e `npx eas-cli@latest init` (grava o `projectId` no
   `app.json`). O build baixa o `@gabrielzubioli/db` do GitHub Packages:
   crie o segredo com um PAT (classic) só com `read:packages` —
   `npx eas-cli@latest env:create --name GITHUB_PACKAGES_TOKEN --value <PAT> --visibility secret --environment production --environment preview`.
   O hook `eas-build-pre-install` (`scripts/eas-npmrc.mjs`) o escreve no
   `~/.npmrc` da máquina de build.
2. Chave de upload: `npx eas-cli@latest credentials` → Android → production → _Upload a
   keystore_, com `apps/android/android.keystore` (senha e alias em
   `apps/android/keystore.env`). **Não** deixe o EAS gerar uma nova: a Play
   recusaria o pacote.
3. Versão: `versionCode` no `app.json` (o TWA parou no 3; o primeiro nativo é
   o 4). Cada envio sobe um.
4. Build: `npx eas-cli@latest build -p android --profile production` (gera o `.aab`).
   As variáveis públicas (`EXPO_PUBLIC_*`) estão no `eas.json`, porque o
   `.env` não vai para o build.
5. Envio: `npx eas-cli@latest submit -p android --profile production` (vai para o teste
   interno). Testar, passar para o teste fechado e só então produção.
6. Depois de publicado: apagar `apps/android`. Manter o
   `public/.well-known/assetlinks.json` do web: é o que permitirá links do site
   (como o de nova senha) abrirem direto no app.

## Build nativo no Windows

O caminho do projeto é longo, e alguns arquivos do C++ (gesture-handler,
reanimated) passam do limite de 260 caracteres do Windows. O erro aparece como
`Filename longer than 260 characters` ou `ninja: manifest 'build.ninja' still
dirty after 100 tries`. O C++ compila por uma letra de unidade curta (`subst`);
o resto precisa do caminho real, porque o Node converte `H:` em `C:` e o
codegen e o Metro se perdem com os dois misturados:

```sh
subst H: C:\Users\<você>\Projetos\forja\forja-frontend   # uma vez por sessão do Windows

# pelo caminho real (C:\...\apps\mobile)
npx expo prebuild --platform android                     # quando mudar app.json/plugins
cd android && ./gradlew generateCodegenArtifactsFromSchema && cd ..

# pela unidade curta: compila o C++ e instala no emulador
cd H:\apps\mobile && npx expo run:android --no-bundler

# de volta ao caminho real: o Metro
cd C:\...\apps\mobile && npx expo start --dev-client
```

O Gradle precisa do JDK 17 (o do Bubblewrap serve): `JAVA_HOME` apontando
para `~/.bubblewrap/jdk-17...` antes do `gradlew`/`run:android`.

Com o `@gabrielzubioli/db` ligado por `npm link` ao forja-backend, o
`metro.config.js` observa o caminho real do pacote e usa uma cópia só do
`@powersync/common` (a do frontend). Mudou o `metro.config.js`: reinicie o
Metro.

Não rode o Metro com `CI=1`: nesse modo ele não observa os arquivos, e nenhuma
edição chega ao app sem reiniciar.
