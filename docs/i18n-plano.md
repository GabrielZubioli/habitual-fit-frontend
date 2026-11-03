# Plano: tradução para inglês e espanhol + lançamento em todas as regiões

> Status: **em andamento** (branch `feat/i18n-en-es`). Fases 0 a 3 prontas (1.589 frases em en e es; páginas legais com versão completa por idioma, aguardando revisão jurídica). Próximo: fase 4 (banco) e fase 5 (loja).
> Repos: `forja-frontend` (web + mobile + app-core) e `forja-backend` (banco, edge functions).

## Objetivo

- App (web e mobile/Expo) em **pt-BR, en e es**.
- Idioma escolhido pelo aparelho/navegador: `pt-*` → pt-BR, `es-*` → es, **qualquer outro → en**.
- Play Store liberada para **todos os países/regiões**, com página da loja em pt-BR, en-US, es-419 e es-ES.

## Decisões (já tomadas, não reabrir)

| Decisão | Escolha | Por quê |
|---|---|---|
| Biblioteca | `i18next` + `react-i18next` | Funciona igual no Vite e no Expo; plural e interpolação prontos. |
| Onde ficam as traduções | `packages/app-core/src/i18n/` (`en.json`, `es.json`) | Web e mobile repetem as mesmas telas; uma frase é traduzida uma vez só. |
| Formato da chave | **O próprio texto em pt-BR** (`t("Sua semana")`) | Permite a troca automática por codemod; pt-BR não precisa de arquivo. `keySeparator: false`, `nsSeparator: false`, `fallbackLng: false` (a chave já é o pt). |
| Interpolação | `t("{{n}} treinos", { n })` | Padrão do i18next. |
| Plural | sufixos do i18next (`_one` / `_other`) só onde o código já distingue singular/plural | Não reescrever lógica que já funciona. |
| Seleção de idioma | Automática pelo aparelho; **sem seletor em Configurações por enquanto** | YAGNI — adicionar se usuário pedir. |
| Unidades (kg/lb) | **Fora do escopo** | Kg serve no mundo todo exceto EUA; avaliar depois do lançamento. |
| Base de alimentos | Traduzir nomes exibidos? **Não nesta leva** — alimentos seguem com nome do banco | Base é brasileira (TACO); a solução real é outra base (Open Food Facts/USDA), decisão de produto. |
| App que vai para a Play | `apps/mobile` (Expo) | `apps/android` (TWA) não é o alvo. |

## Fase 0 — Preparação (≈30 min)

- [x] Criar branch `feat/i18n-en-es` a partir da `main` no `forja-frontend`.
- [x] Ler `docs/padroes.md` e `docs/decisoes-de-arquitetura.md` para seguir as convenções.
- [x] Rodar `npm run verify` e anotar o estado inicial (tudo verde antes de começar).

## Fase 1 — Infraestrutura (PR 1)

**Arquivos novos**
- `packages/app-core/src/i18n/index.ts`
  - Detecta o idioma: `globalThis.navigator?.language` (web) → `Intl.DateTimeFormat().resolvedOptions().locale` (mobile/Hermes) → normaliza para `"pt-BR" | "en" | "es"`.
  - Mobile: ~~preferir `expo-localization`~~ — feito com o `Intl` do Hermes, que já reflete o idioma do sistema; sem módulo nativo extra.
  - Inicializa o i18next **de forma síncrona** (`initImmediate: false`, recursos embutidos) para que `t()` funcione em constantes de módulo.
  - Exporta: `t`, `LOCALE` (`"pt-BR" | "en-US" | "es"` para `Intl`), `language`, `dateFnsLocale`.
- `packages/app-core/src/i18n/en.json`, `es.json` — começam vazios `{}`.
- `scripts/i18n-check.mjs` + teste em `scripts/i18n-check.test.mjs`
  - Lista todas as chaves usadas em `t("...")` no código e falha se faltar alguma em `en.json` ou `es.json`, ou se houver chave órfã.
  - Entrar no `npm run verify` (via `test:scripts` ou script próprio).

**Ajustes**
- `packages/app-core/package.json`: dependências `i18next`, `react-i18next`; export `./i18n`.
- `apps/mobile`: nada a configurar — o app-core detecta o idioma pelo `Intl` ao ser importado.
- `apps/web/src/routes/__root.tsx:103`: `<html lang={LOCALE}>`.
- `packages/app-core/src/lib/date.ts`: trocar `ptBR` fixo por `dateFnsLocale` (pt-BR → `ptBR`, en → `enUS`, es → `es`). Atualizar o comentário da regra 2.
- `apps/web/src/components/date-picker.tsx`: `locale={dateFnsLocale}`.
- Substituir os **88 `"pt-BR"` fixos** em `toLocaleString`/`Intl.*` por `LOCALE`
  (`grep -rn '"pt-BR"' apps packages --include=*.ts*`).

**Pronto quando**: app abre igual em pt-BR; com o navegador/aparelho em inglês, datas e números já saem em inglês; `npm run verify` verde.

## Fase 2 — Codemod de extração (PR 1 ou 2)

`scripts/i18n-extract.mjs` usando a API do TypeScript (já instalado). Roda em modo **relatório** (`--dry`) e **escrita** (`--write`), por pasta.

**Envolve com `t()`**
- `JsxText` com letras (trim). Elemento cujos filhos são só texto + expressões simples vira **uma frase** com `{{0}}`, `{{1}}`.
- Atributos JSX: `placeholder`, `title`, `aria-label`, `alt`, `label`, `description`, `accessibilityLabel`.
- Strings/template literals em `toast.*(...)`, `throw new Error(...)` exibidos ao usuário, `meta` de `head()` (title/description), `Alert.alert`.
- Strings com cara de texto de UI (tem espaço ou acento e começa com letra) fora das exclusões abaixo.

**Nunca mexe em**
- `className`, `class`, `style`, `href`, `to`, `src`, `key`, `id`, `testID`, `type`, `variant`, `name` de input.
- Argumentos de `cn()`, `clsx()`, `console.*`, `import`, `require`, `.from()`, `.select()`, `.eq()`, `queryKey`, `createFileRoute()`.
- Nomes de propriedades, comparações (`=== "..."`), valores de enum do banco.
- Comentários e arquivos `*.test.*`, `routeTree.gen.ts`.

**Saída**: adiciona `import { t } from "@forja/app-core/i18n"` e grava a lista de chaves novas em `scripts/.i18n-pending.json` (para a fase de tradução). Itens duvidosos vão para um relatório para revisão manual, não são trocados.

**Pronto quando**: o `--dry` em uma pasta pequena (`apps/web/src/routes/auth.tsx` e amigos) gera diffs corretos à mão; nenhum `className` ou query tocado.

## Fase 3 — Tradução (repetir por área)

1. Rodar o codemod `--write` na área.
2. Revisar o diff à mão (frases quebradas, textos que não deviam ser traduzidos).
3. Traduzir as chaves pendentes para en e es em lotes de ~150, usando o **glossário** abaixo. Inglês americano; espanhol neutro (latino-americano, "tú").
4. `npm run verify` + abrir a tela em pt, en e es (web: idioma do navegador; mobile: idioma do emulador).
5. Commit da área.

**Ordem das áreas** (uma PR cada, ou agrupadas se pequenas)
1. Login, cadastro, esqueci/nova senha, confirme e-mail, preparando, onboarding — **primeira impressão**.
2. Shell: menus, abas, command palette, `route-error`, `query-boundary`, toasts genéricos.
3. `packages/app-core/src/lib/labels.ts` (músculos, equipamentos, categorias, níveis de atividade) e `packages/domain` (ex.: `WEEKDAY_LABELS`, mensagens de validação).
4. Início (dashboard) e cards da home.
5. Treinos: rotinas, calendário, sessão, exercícios, biblioteca, pickers.
6. Dieta, receitas, alimentos (só a interface), cardápio semanal.
7. Corpo, progresso, fotos, estatísticas, gráficos.
8. Perfil, configurações, exportar/importar, excluir conta, compartilhar perfil.
9. Páginas legais (`privacidade`, `termos`, `packages/app-core/src/lib/legal.ts`) — **revisão humana obrigatória**.
10. `packages/app-core/src/data/coach-faq.ts`.

Web e mobile da mesma área no mesmo passo — as frases se repetem e as chaves são compartilhadas.

**Glossário** (fixar antes de traduzir; salvar em `packages/app-core/src/i18n/GLOSSARIO.md`)

| pt-BR | en | es |
|---|---|---|
| Treino | Workout | Entrenamiento |
| Série | Set | Serie |
| Repetição | Rep | Repetición |
| Carga | Weight | Peso |
| Descanso | Rest | Descanso |
| Falha | Failure | Fallo |
| Rotina / Plano | Routine / Plan | Rutina / Plan |
| Refeição | Meal | Comida |
| Macros | Macros | Macros |
| Meta | Goal | Meta |
| Sequência (streak) | Streak | Racha |
| Pesagem | Weigh-in | Pesaje |
| Habitual Fit | Habitual Fit (não traduz) | Habitual Fit |

## Fase 4 — Conteúdo do banco (forja-backend)

- [ ] Migration: `exercises.name_es` e `exercises.execution_es` (nullable).
- [ ] Preencher a partir de `name_en`/`execution_en` (script de tradução em lote, revisão por amostragem).
- [ ] Atualizar `packages/db` (`schema.ts`/`types.ts`), publicar nova versão de `@gabrielzubioli/db` e atualizar no frontend.
- [ ] Incluir as colunas nas regras de sync do PowerSync (`docs/powersync.md`) e na publication.
- [ ] Frontend: helper único `exerciseName(ex)` / `exerciseExecution(ex)` em `packages/app-core/src/data/exercise-library.ts` que escolhe a coluna pelo idioma, com fallback pt → en. Substituir os usos em `exercise-detail.ts`, `exercise-search.ts`, `exercise-how-to.tsx` (web e mobile), `exercise-detail-sheet.tsx`. A busca deve procurar no idioma atual também.
- [ ] Coach (`supabase/functions/coach/index.ts`): aceitar `locale` no corpo da requisição; o prompt da linha ~283 passa a dizer "Responda em {idioma}". `packages/app-core/src/data/coach-chat.ts` envia `language`.

## Fase 5 — Sistema e loja

- [ ] `apps/mobile/app.json`: textos de permissão (câmera/fotos) e nome do app via `expo.locales` (`locales/en.json`, `locales/es.json`).
- [ ] Notificações locais/push: textos passam pelo `t()`.
- [ ] Build novo (`versionCode` +1) e teste no emulador em en e es.
- [ ] Play Console → Página principal da loja: adicionar **en-US, es-419, es-ES** (título, descrição curta, descrição completa, capturas de tela em cada idioma).
- [ ] Play Console → Política de privacidade em inglês publicada (GDPR: dados de saúde — peso, medidas, fotos — são categoria sensível; revisar texto antes de liberar a UE).
- [ ] Play Console → Produção → **Países/regiões: adicionar todos**.
- [ ] Assinaturas: conferir preços convertidos por país.

## Riscos e cuidados

- **Frases quebradas**: texto com `<strong>` no meio vira pedaços separados — revisar na mão e, onde a gramática quebrar, usar `<Trans>` do react-i18next.
- **Mudar uma frase em pt quebra a tradução**: o `i18n-check` pega isso no `verify`. Ao editar um texto pt, atualizar as chaves em en/es junto.
- **`t()` em constante de módulo** só funciona porque o i18n inicializa síncrono e o idioma não muda em tempo de execução. Se um dia houver seletor de idioma, trocar por recarregar o app.
- **Layout**: alemão não está no escopo, mas inglês/espanhol podem ser ~20–30% mais longos que o pt em alguns botões — conferir abas e chips no mobile.
- **Testes** que comparam textos pt continuam passando (ambiente de teste roda em pt-BR). Fixar `language: "pt-BR"` no setup do vitest se necessário.

## Checklist final

- [ ] `npm run verify` verde nos dois repos.
- [ ] Web e mobile percorridos inteiros em pt-BR, en e es sem texto em português sobrando (fora nomes de alimentos).
- [ ] Datas, números e dias da semana no idioma certo.
- [ ] Coach responde no idioma do usuário.
- [ ] Página da loja nos 4 idiomas e todos os países liberados.
