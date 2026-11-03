# Migração do app web para Expo (React Native)

Plano para trocar o app Android atual (TWA, que abre o site) por um app nativo
em `apps/mobile`, **com as mesmas telas, os mesmos fluxos, os mesmos dados e o
mesmo visual** do app web. Escrito em 30/10/2026.

## Expo ou React Native?

Não é uma escolha entre os dois: **Expo é o jeito recomendado de usar React
Native**. O app continua sendo React Native. O Expo cuida do que dá trabalho em
volta: build na nuvem (EAS Build), envio para as lojas (EAS Submit), módulos
nativos prontos (câmera, notificações, armazenamento seguro), atualização do
código JS sem passar pela loja (EAS Update) e rotas por arquivos (Expo Router).
Usar React Native "puro" só faz sentido para um módulo nativo muito específico,
e mesmo nesse caso o Expo deixa escrever um. `apps/mobile` já está no Expo SDK 57.

## O que "exatamente igual" significa aqui

React Native não usa HTML nem CSS. Então os **componentes visuais são
reescritos**, e a lógica é **reaproveitada**:

| Camada                                                                  | Reaproveita?    | Como                                                                                         |
| ----------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| Regras de negócio (`packages/domain`)                                   | Sim, 100%       | Já é pura e já é pacote compartilhado.                                                       |
| Acesso a dados (`apps/web/src/data`, cerca de 6.800 linhas)             | Sim, quase tudo | São consultas ao Supabase e TanStack Query, sem DOM. Vira pacote compartilhado.              |
| Utilitários (`lib/`, `hooks/`)                                          | Em boa parte    | Os puros vão junto; os que usam `window`, `document` ou `localStorage` ganham versão nativa. |
| Telas e componentes (`routes/` + `components/`, cerca de 30.000 linhas) | Não             | Reescritos em RN, com o mesmo layout, textos, tokens e ordem.                                |
| Visual (cores, fontes, raios, sombras)                                  | Sim             | Os tokens de `styles.css` viram o tema do NativeWind.                                        |

A meta é **paridade visual e funcional**, conferida por screenshot lado a lado
(fase 7). O que muda de propósito é só o que no celular nativo funciona melhor
do jeito do sistema: teclado, voltar do Android, seletores de data, folhas que
sobem de baixo e háptico.

## Decisões (confirmadas em 30/10/2026)

1. **Online primeiro, PowerSync depois.** `decisoes-de-arquitetura.md` fala em
   offline-first com PowerSync. Para chegar à paridade mais rápido e com menos
   risco, a recomendação é que a v1 nativa use **as mesmas consultas Supabase
   do web** (o pacote compartilhado) e que o PowerSync entre numa fase própria
   depois (fase 8). Fazer os dois ao mesmo tempo dobra a superfície de bugs.
2. **Onde fica o código compartilhado.** Recomendação: um pacote novo,
   `packages/app-core`, com `data/`, `hooks/` e as partes puras de `lib/`. O
   web passa a importar de lá. O Lovable foi removido do projeto, então mover
   arquivos para fora de `apps/web` não tem mais restrição.
3. **NativeWind 4 × Tailwind 4.** O web usa Tailwind 4 e o scaffold usa
   NativeWind 4, que roda sobre Tailwind 3. As classes são quase as mesmas,
   mas os tokens são declarados de forma diferente. Antes da fase 0, ver se o
   NativeWind 5 (Tailwind 4) já está estável; se estiver, usá-lo.
4. **Tokens desatualizados no scaffold.** `apps/mobile/global.css` usa o âmbar
   antigo. A marca hoje é verde (`#01D798`). Os tokens vêm do `styles.css` do web.

## Equivalências de bibliotecas

| Web                                                           | Nativo                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| TanStack Router (`routes/`)                                   | Expo Router (`app/`), também por arquivo                                        |
| TanStack Query                                                | O mesmo                                                                         |
| Tailwind 4 + shadcn/Radix (47 componentes em `components/ui`) | NativeWind + componentes próprios em `apps/mobile/src/ui`                       |
| Dialog, Sheet, Drawer (vaul)                                  | `@gorhom/bottom-sheet` e `Modal`                                                |
| Select, Dropdown, Popover                                     | Bottom sheet com lista (padrão do celular)                                      |
| Recharts (5 arquivos)                                         | `victory-native` (Skia)                                                         |
| `@dnd-kit` (reordenar exercícios)                             | `react-native-reorderable-list`                                                 |
| Embla carousel                                                | `FlatList` horizontal com paginação                                             |
| sonner (toasts)                                               | `sonner-native`                                                                 |
| react-day-picker                                              | Calendário próprio ou `react-native-calendars`                                  |
| lucide-react                                                  | `lucide-react-native` (mesmos ícones)                                           |
| Body map em SVG (`muscle-paths.ts`)                           | `react-native-svg`, com os mesmos paths                                         |
| Fonte Inter (Google Fonts)                                    | `@expo-google-fonts/inter`                                                      |
| `localStorage` / `sessionStorage`                             | `react-native-mmkv`                                                             |
| Sessão do Supabase                                            | `expo-secure-store` com LargeSecureStore (já anotado no scaffold)               |
| Login com Google (Google Identity Services, só web)           | `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken` |
| `getUserMedia` (fotos de progresso)                           | `expo-camera` / `expo-image-picker`                                             |
| `canvas` + `toBlob` (imagem do perfil para compartilhar)      | `react-native-view-shot` + `expo-sharing`                                       |
| `to-webp`                                                     | `expo-image-manipulator`                                                        |
| `Notification` (fim do descanso)                              | `expo-notifications` (notificação local agendada)                               |
| Wake Lock (tela acesa no treino)                              | `expo-keep-awake`                                                               |
| Download de arquivo (exportar dados)                          | `expo-file-system` + `expo-sharing`                                             |
| Upload de arquivo (importar dados)                            | `expo-document-picker`                                                          |
| Streaming do coach (`fetch` + `ReadableStream`)               | `fetch` de `expo/fetch` (tem streaming)                                         |
| Command palette (Ctrl+K, `cmdk`)                              | Não entra: é atalho de teclado de desktop. A busca continua nas telas.          |
| Links dos emails (confirmar email, nova senha)                | App Links com o `assetlinks.json` que já existe + `expo-linking`                |

## Fases

Cada fase termina com o app instalável (build de desenvolvimento) e as telas
dela conferidas contra o web. As estimativas são para uma pessoa com agentes,
em semanas de trabalho.

### Fase 0: fundação (1 semana)

- Criar `packages/app-core` e mover `data/`, `hooks/` e o `lib/` puro; o web
  passa a importar de lá, e `npm run verify` continua verde.
- Cliente Supabase do mobile com LargeSecureStore; `@forja/domain` e
  `app-core` resolvendo no Metro.
- Tema: tokens de `styles.css` em `tailwind.config.js` e `global.css`
  (claro e escuro), fonte Inter, `lucide-react-native`.
- Componentes base em `src/ui`: Button, Card, Input, Chip, Sheet, Dialog,
  Tabs, Switch, Slider, Progress, Skeleton, Toast, com estados de loading,
  vazio e erro (o equivalente a `query-boundary` e `status-screen`).
- Shell: barra de abas igual à do web (Início, Plano, **Treinar** no meio,
  Dieta, Menu) e o menu com as demais telas.
- EAS configurado: `eas.json` com perfis development, preview e production.

**Andamento (30/10/2026):**

- [x] `packages/app-core` com `data/`, os hooks e o `lib/` portáveis. Cada app
      registra o seu cliente com `configureSupabase()`. O web importa
      `@forja/app-core/...`; os testes migraram junto (`npm run test:core`).
- [x] Cores geradas do `styles.css` do web (`npm run tokens:mobile` →
      `src/theme/tokens.gen.json`), aplicadas com `vars()` do NativeWind.
      Escuro por padrão, como no web. Raios iguais aos do web.
- [x] Cliente Supabase do mobile registrado no `app-core`.
- [x] Emulador Android local (AVD `habitual`, SDK em `~/.bubblewrap`).
- [x] Fonte Inter (400/600/700/900, os pesos que o web usa) embutida pelo
      plugin do `expo-font`; `1rem = 16px` como no web (`inlineRem`).
- [x] Shell: barra de abas igual à do web (Início, Plano, Treinar no centro,
      Dieta, Menu) e o Menu (cartão do perfil, destaques, lista, modo escuro).
      Conferido lado a lado com o web no mesmo tamanho de tela. As telas
      mostram o cabeçalho real e "em construção".
- [x] `createQueryClient` (cache e retry) no `app-core`, usado pelos dois apps.
- [ ] Ícones lidos do `lucide-react` e painel com `Modal` nativo: trocar por
      `lucide-react-native` e `@gorhom/bottom-sheet`.
- [x] Sessão no SecureStore em pedaços de 1,8 KB (`app-core/lib/chunked-storage.ts`, com teste), sem pacote novo: acima de ~2 KB a gravação falhava e o app abria deslogado.

Os itens em aberto dependem de pacotes novos, e o `npm install` precisa do
token do GitHub Packages (por causa do `@gabrielzubioli/db`).

### Fase 1: entrada (1 semana)

`auth`, `criar-conta`, `esqueci-senha`, `nova-senha`, `confirme-email`,
onboarding com 18 passos (`index`), `preparando`, `termos` e `privacidade`.
Login com Google nativo (precisa de um client OAuth Android no Google Cloud,
com o SHA-1 da chave da Play App Signing). No iOS, se o Google existir, a
Apple exige também "Entrar com Apple" (diretriz 4.8).

**Andamento (30/10/2026):**

- [x] Boas-vindas e questionário de 18 passos (`app/index.tsx`), com os mesmos
      textos, regras e rascunho salvo no aparelho (SecureStore).
- [x] Entrar e criar conta (`app/auth.tsx`) no layout de celular do web:
      painel verde de 30%, a mão em marca-d'água, a bolha que desce na troca,
      campos com rótulo que sobe, força da senha, aviso de conta existente.
- [x] Esqueci a senha e confirme seu e-mail.
- [x] Montagem do plano e "plano pronto" (`app/preparando.tsx`), gerados no
      banco pelo `app-core`.
- [x] Telas logadas protegidas (`app/(app)/_layout.tsx`); cartão do Menu com
      nome e foto reais.
- [x] Testado no emulador de ponta a ponta: cadastro → questionário →
      plano montado → Início, e login com a conta demo. Comparado com o web.
- [x] Login com Google nativo (`@react-native-google-signin`): ID token do cliente web + `signInWithIdToken`. Clientes Android com os SHA-1 de debug, upload e Play criados (ver `apps/mobile/README.md`).
- [x] Nova senha dentro do app: o "esqueci a senha" do app manda o link para `habitualfit://nova-senha` (tela `app/nova-senha.tsx`). Precisa da URL na lista de redirecionamento do Supabase.
- [x] Termos e privacidade abrem no site — decisão: o texto jurídico fica
      num lugar só (o site), em vez de duas cópias que podem divergir.

### Fase 2: Treinar (2 semanas, é o coração do app)

`train`, `workouts_.session.$id` (registro de séries, RPE, cronômetro de
descanso com notificação local, tela acesa, háptico ao concluir série,
recordes), `workouts`, `workouts_.calendar`, finalização do treino e sequência
de dias.

**Andamento (30/10/2026):**

- [x] Treinar (`(tabs)/train.tsx`): treino de hoje, outros treinos, descanso
      ou "já treinou hoje", no verde da marca; com treino aberto, vai a ele.
- [x] Treino em andamento (`(tabs)/workouts/session/[id].tsx`): paleta laranja
      dos tokens `--t-*`, cronômetro pelo `started_at`, um exercício por vez,
      demonstração, última vez, anilhas, dica de progressão, séries com − e +,
      RIR, concluir série, + e − série, descartar, terminar com confirmação,
      comemoração com comparação e recordes; correção de treino terminado.
- [x] Descanso com notificação local agendada (toca com a tela bloqueada),
      vibração, som liga/desliga e o recorte do botão central.
- [x] Botão central "gravando": anel do tempo, relógio e o quadradinho que
      termina o treino de dentro dele. Tela acesa durante o treino.
- [x] Calendário de treinos.
- [x] Todas as telas logadas com a barra de baixo, como no web.
- [x] Testado no emulador: começar treino → ajustar carga → concluir série →
      descanso → terminar → comemoração; calendário com o treino do dia.
- [x] Trocar exercício no meio do treino (fase 7).
- [x] Mudar a data de um treino terminado (fase 7).
- [x] A transição do punho ao tocar em Treinar (fase 7).

### Fase 3: Plano e exercícios (1,5 semana)

`plan` (agenda do dia e rotinas), `workouts_.routines.new`,
`workouts_.templates.$id` (com reordenar arrastando), `exercises`,
`exercises_.$id` (demonstração e body map).

**Andamento (31/10/2026):**

- [x] Plano (`(tabs)/plan.tsx`): agenda um dia por vez com a área trabalhada
      no boneco, rotinas, linhas de exercício editáveis no lugar (séries,
      repetições, descanso, RPE), duplicar, trocar e remover.
- [x] Nova rotina (`(tabs)/workouts/routines/new.tsx`).
- [x] Exercícios (`(tabs)/exercises/index.tsx`): grupos com recorte do
      boneco, equipamentos, favoritos, busca e lista infinita com filtros;
      criar exercício.
- [x] Ficha do exercício (`(tabs)/exercises/[id].tsx`): GIF ou fotos com o
      crédito da fonte, músculos no boneco, passo a passo, dicas, erros,
      contraindicações, vídeos; histórico com recorde, sessões, evolução e
      gráficos em SVG (`src/ui/charts.tsx`, sem tooltip por enquanto).
- [x] Consultas da ficha e da biblioteca em `@forja/app-core`
      (`data/exercise-detail.ts`, `data/exercise-library.ts`), usadas pelo web
      e pelo app.
- [x] Testado no emulador: agenda por dia com o boneco, biblioteca → grupo →
      ficha, busca, histórico vazio e com treino (recorde, gráficos).
- [x] `workouts_.templates.$id` fica fora: no web só a paleta de comandos chega nela.
- [x] Reordenar arrastando: o web também não tem (só as setas da tela de templates, que fica fora).

### Fase 4: Dieta e receitas (1,5 semana)

`diet` (anéis de macros, refeições, cardápio da semana, substituições, água),
busca de alimentos, `recipes`, `recipes_.$id`. As imagens de
`public/receitas` (3,7 MB) passam a ser carregadas da URL do site, com cache
do `expo-image`, em vez de irem no pacote do app.

**Andamento (31/10/2026):**

- [x] Diário (`(tabs)/diet.tsx`): semana no cabeçalho, seletor de data,
      anel de calorias e anéis de macros (`src/ui/macro-rings.tsx`),
      refeições que se fecham ao concluir, marcar item (otimista), ajustar
      gramas, substituir, remover, renomear (semana ou só o dia), copiar o dia
      anterior.
- [x] Cardápio da semana (`src/ui/weekly-menu.tsx`): dia a dia, totais contra
      a meta, adicionar alimento, tirar (só do dia ou da semana), copiar dia.
- [x] Seletor de alimento com quantidade e aba Receitas
      (`src/ui/food-picker.tsx`), substituição (`src/ui/substitute-food-dialog.tsx`),
      seletor de data (`src/ui/date-picker.tsx`, reaproveitável).
- [x] Receitas (`(tabs)/recipes/index.tsx`) e editor (`(tabs)/recipes/[id].tsx`):
      fileiras por categoria, detalhe das prontas, copiar, criar, excluir,
      ingredientes, lançar no diário.
- [x] Consultas e escritas em `@forja/app-core` (`data/diet-day.ts`,
      `data/foods.ts`, `data/profile.ts`, `data/recipes.ts`), usadas pelo web
      e pelo app; regra das refeições exibidas com teste.
- [x] Fotos das receitas vêm do site (`src/lib/site.ts`,
      `EXPO_PUBLIC_SITE_URL`), com o cache do `Image` do React Native —
      `expo-image` fica para quando der para instalar pacotes.
- [x] Testado no emulador: adicionar alimento no cardápio → aparece no dia →
      marcar → anéis; data, substituição, receitas → copiar → editor → salvar
      → excluir.
- [x] Água: no web fica no Início — feita na fase 5.

### Fase 5: Progresso (1 semana)

`body` (peso, tendência, medidas, fotos de progresso com câmera), `stats`
(gráficos em `victory-native`), prontidão do corpo e `dashboard` completo.

**Andamento (31/10/2026):**

- [x] Início (`(tabs)/dashboard.tsx`): sequência com o fogo, semana navegável
      com o treino de hoje e "Começar", prontidão, peso contra a meta com o
      gráfico de 90 dias, dieta do dia e água (`src/ui/home-cards.tsx`).
- [x] Estatísticas (`(tabs)/stats.tsx`): a semana contra a meta, treinos por
      semana, números, mapa do ano, músculos (equilíbrio, fadiga, força) e os
      últimos treinos.
- [x] Corpo (`(tabs)/body.tsx`): Resumo (peso, ritmo, IMC, gordura, metas),
      Peso (registrar + 180 dias com tendência) e Medidas (por região, com as
      faixas, tendências e histórico).
- [x] Gráficos em SVG próprios (`src/ui/charts.tsx`: peso + tendência,
      semanal, mini-gráfico) em vez de `victory-native` — nenhum pacote novo.
- [x] Consultas em `@forja/app-core` (`data/body.ts`, `data/workouts.ts`),
      usadas pelo web e pelo app; validação das medidas com teste.
- [x] Testado no emulador: água (+ e desfazer), Estatísticas nas três abas,
      Corpo nas três abas, salvar e excluir medidas.
- [ ] Fotos de progresso: desligadas no web (`FOTOS_LIBERADAS = false`).
      Quando voltarem, a câmera é o `expo-camera` (já instalado); a galeria
      precisa do `expo-image-picker`.

### Fase 6: Conta e coach (1 semana)

`profile` (com a imagem de compartilhar), `settings` (tema, exportar,
importar, excluir conta), `coach` (chat com streaming).

**Andamento (01/11/2026):**

- [x] Perfil (`(tabs)/profile.tsx`): faixa da marca, foto, nome, objetivo e
      jeito de treinar, evolução com o mapa do ano, jornada até a meta,
      destaques, dados pessoais editáveis no lugar, metas manuais, sair.
- [x] Foto de perfil pela câmera frontal (`src/ui/avatar.tsx`, `expo-camera`).
- [x] Compartilhar perfil (`src/ui/share-profile-dialog.tsx`): as mesmas
      opções e a prévia do cartão; envia o resumo em texto pelo
      compartilhamento do sistema.
- [x] Configurações (`(tabs)/settings.tsx`), cada seção pelo Menu
      (`?secao=`): metas nutricionais, treino, alimentação, saúde e conta —
      importar CSV (seletor de arquivo do sistema), exportar JSON/CSV (grava na
      pasta escolhida), excluir conta, sair.
- [x] Consultas e regras em `@forja/app-core` (`data/profile.ts`,
      `data/export.ts`, `data/avatar.ts`, `lib/share-profile.ts`), usadas pelo
      web e pelo app; com testes.
- [x] Corrigido no código compartilhado: a exportação pedia
      `food_log_entries.meal_type` (a coluna é `meal_slot`) e falhava — no web
      também.
- [x] `npm run test:scripts` confere que todo ícone importado pelo app existe
      de verdade (apelidos do lucide sem `__iconNode` quebravam a tela).
- [x] Testado no emulador: Perfil, edição de campo, compartilhar, seções de
      Configurações e exportar JSON até o arquivo gravado.
- [ ] Coach: desligado no web (`TREINADOR_LIBERADO = false`); fica fora.
- [x] Foto de perfil pela câmera ou galeria do sistema, já recortada (`expo-image-picker`, no lugar do `expo-camera`); cartão do perfil enviado como imagem PNG (`react-native-view-shot` + `expo-sharing`), com o texto de reserva.
- [ ] `expo-file-system` foi declarado no `package.json` do app (já vinha com
      o `expo`); rodar `npm install` para o lockfile registrar.

### Fase 7: paridade e lançamento (1 semana)

- **Comparação lado a lado**: as mesmas telas, com a mesma conta demo
  (`zubioligabriel+habitualdemo@gmail.com`), no web pelo Playwright e no app
  pelo Maestro, no mesmo tamanho de tela. Cada diferença vira item da lista
  até zerar.
- Testes de fluxo no Maestro: cadastro → onboarding → treino → refeição →
  peso.
- Build de produção com **o mesmo pacote (`com.habitualfit.myapp`)** e **a
  mesma chave de upload** do TWA (`eas credentials`, importando
  `apps/android/android.keystore`). O `versionCode` continua de onde o TWA
  parou (acima de 3).
- Teste interno, depois teste fechado, e só então produção. A atualização
  troca o TWA pelo nativo na mesma página da loja, sem perder instalações
  nem avaliações.
- Depois de publicado: apagar `apps/android`.

**Andamento (01/11/2026):**

- [x] Trocar exercício no meio do treino (`src/ui/substitute-exercise-dialog.tsx`;
      busca em `app-core/data/exercise-search.ts`, usada também pelo web).
- [x] Mudar a data de um treino terminado (seletor de data na sessão).
- [x] A transição do punho ao tocar em Treinar (`src/ui/train-launch.tsx`):
      o braço sobe por trás da barra, a navegação acontece no meio.
- [x] Corrigidos: a sessão descartada continuava montada e buscava o treino
      apagado ("Registro não encontrado"); a tela da sessão não zerava o
      exercício aberto, a edição e a comemoração ao trocar de treino.
- [x] `eas.json` (perfis development, preview e production; variáveis
      públicas no perfil base), `versionCode` 4 e versão 1.1.0 no `app.json`,
      texto da permissão de câmera corrigido (não há leitor de código de
      barras), passo a passo de publicação no `apps/mobile/README.md`.
- [ ] Comparação lado a lado e fluxos no Maestro: o Maestro não está
      instalado; a paridade foi conferida tela a tela no emulador em cada fase
      contra o web.
- [ ] Publicação (do seu lado): `eas login`/`eas init`, importar a chave de
      upload do TWA em `eas credentials`, `eas build` e `eas submit` — ver o
      README do app.

### Fase 8: offline com PowerSync (2 semanas, opcional)

Ligar o PowerSync (o schema já está em `@gabrielzubioli/db`) para o treino
funcionar sem internet na academia: as leituras passam a vir do SQLite local
e as escritas entram numa fila de sincronização. É onde o nativo passa a ser
melhor que o web, e não só igual.

**Decisões (01/11/2026):** a instância do PowerSync é criada por você (conta e
custo); o alcance é o app inteiro.

**Andamento (02/11/2026):**

- [x] Backend (forja-backend): schema local do PowerSync **gerado** dos tipos
      do Postgres (`packages/db/scripts/build-powersync-schema.mjs`, roda no
      `db:types`; o escrito à mão tinha ficado para trás), com o mapa das
      colunas array/JSON; regras (`sync/streams.yaml`) cobrindo as 25 tabelas
      que o app usa, receitas prontas no catálogo, `id` derivado nas tabelas
      de chave composta; tabelas que não existem no banco fora;
      `sync:validate` agora acusa tabela sem `id`; migration da publicação;
      guia de configuração em `docs/powersync.md`; `@gabrielzubioli/db` 0.2.0.
- [x] Corrigido nas regras antigas: `exercise_muscles` não tem coluna `id` e
      nunca desceria para o aparelho.
- [x] App: `@powersync/react-native` + `@op-engineering/op-sqlite` no build
      nativo (o `quick-sqlite`, que falhava, não é mais usado); conector
      (`src/lib/powersync.ts`) com as credenciais da sessão do Supabase,
      envio da fila por upsert/update/delete (chave natural nas tabelas de
      chave composta; erro permanente descarta a operação para não travar a
      fila); a cada sincronização as telas são renovadas; ao sair da conta o
      banco local é apagado. Liga só com `EXPO_PUBLIC_POWERSYNC_URL`.
- [x] `@forja/app-core/local`: o ponto de injeção do banco local para a
      camada de dados (a web nunca registra).
- [x] Testado no emulador com uma URL fictícia: banco local abre com as 25
      tabelas e o `uuid()` da extensão; o motor de sincronização tenta
      conectar com o token da sessão.
- [x] Instância criada (02/11/2026): projeto `Habitual-Fit`, instância
      `Production` (região `br`), 25 tabelas replicando. URL no `.env` e no
      `eas.json`. Corrigido nas streams: tabela com apelido no `FROM` era
      gravada no aparelho com o nome do apelido (séries, receitas, cardápio
      e músculos chegariam vazios).
- [x] Leituras e escritas de `app-core/data` no banco local: treino (sessão,
      início, fim, recordes, histórico, recuperação, plano e edição), dieta
      (diário, materialização do dia, água, cardápio, plano, busca de
      alimentos), corpo (peso, medidas, metas), receitas, exercícios
      (biblioteca, ficha, favoritos, busca, substitutos), perfil e
      questionário. Cada função escolhe pelo `localDb()`: o web segue igual.
      Escritas simples por `id` em `data/rows.ts`.
- [x] O app só lê do aparelho depois da primeira sincronização (antes dela
      o banco está vazio); nas aberturas seguintes, na hora, mesmo sem rede.
- [x] Testado no emulador sem rede: treino iniciado, séries, conclusão com
      recorde e avanço da rotina; edição de treino salvo; dieta; peso. Tudo
      subiu ao reconectar. Vigia de 30 s religa a sincronização se uma
      tentativa ficar presa depois da volta da rede (visto uma vez).
- Seguem online por natureza: coach (IA), fotos e avatar (Storage),
  importar/exportar, catálogo inicial e apagar a conta.
- [ ] Do seu lado: publicar o `@gabrielzubioli/db` 0.2.0 e `npm install`.

## Total

Cerca de **9 semanas até a paridade** (fases 0 a 7) e mais 2 para o offline.
O que mais pesa é a fase 2 (registro de treino) e a fase 7 (acertar cada
detalhe visual).

## Riscos

- **Divergência durante a migração**: se o web mudar enquanto o nativo é
  escrito, a tela nativa fica para trás. Com `app-core`
  compartilhado, só o visual pode divergir. Cada mudança de tela no web vira
  um item de paridade.
- **Login com Google**: é a parte com mais configuração externa (Google
  Cloud, SHA-1 da Play App Signing, Supabase). Testar cedo, na fase 1.
- **Performance de listas longas** (880 exercícios, histórico de séries):
  usar `FlashList` desde o começo.
