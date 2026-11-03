# Glossário de tradução

Inglês americano; espanhol neutro (latino-americano, "tú"). Use sempre o mesmo
termo para o mesmo conceito.

| pt-BR              | en                        | es             |
| ------------------ | ------------------------- | -------------- |
| Treino             | Workout                   | Entrenamiento  |
| Série              | Set                       | Serie          |
| Repetição          | Rep                       | Repetición     |
| Carga              | Weight                    | Peso           |
| Descanso           | Rest                      | Descanso       |
| Falha              | Failure                   | Fallo          |
| Rotina / Plano     | Routine / Plan            | Rutina / Plan  |
| Refeição           | Meal                      | Comida         |
| Macros             | Macros                    | Macros         |
| Meta               | Goal                      | Meta           |
| Sequência (streak) | Streak                    | Racha          |
| Pesagem            | Weigh-in                  | Pesaje         |
| Habitual Fit       | Habitual Fit (não traduz) | Habitual Fit   |

## Como adicionar traduções

1. `npm run i18n:extract -- --write <pasta>` envolve os textos e lista as
   frases novas em `scripts/.i18n-pending.json`.
2. Traduza cada frase em `en.json` e `es.json` (a chave é a frase em pt-BR).
   Mantenha os `{{nomes}}` e as marcas `<0>…</0>` do `tRich`.
3. Padrões de data do date-fns (`"d 'de' MMMM"`) também são frases: traduza o
   padrão (`"MMMM d"`, `"d 'de' MMMM"`).
4. `npm run i18n:check` precisa passar.
