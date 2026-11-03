# Gerenciador de tarefas — Artefact

Desafio técnico em Next.js 15, React, TypeScript e tRPC.

## Executar

Use Node.js 24 LTS (indicado em `.nvmrc`) e npm. Nenhuma variável de ambiente é necessária nesta etapa.

```sh
npm ci
npm run dev
```

Acesse http://localhost:3000.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

## Etapa 1: configuração

- App Router e TypeScript em modo estrito.
- tRPC exposto em `/api/trpc`, com uma procedure `health` cuja saída é validada por Zod.
- Cliente tRPC tipado em `src/trpc/client.ts`, sem biblioteca adicional de cache.
- A página inicial consulta a mesma procedure diretamente no servidor, por um caller. O resultado está no HTML inicial, com renderização dinâmica por requisição.
- Os módulos do backend são protegidos por `server-only`. O cliente importa apenas o tipo do router.
- TypeScript permanece na versão 5.9, compatível com o Next.js 15. ESLint 9 é usado por compatibilidade com a configuração oficial dessa versão do Next.js.
- O override de PostCSS atualiza a dependência transitiva do Next.js para corrigir os alertas de segurança identificados pelo npm audit, mantendo a versão principal 8.

## Verificações da configuração inicial

Lint (sem warnings), tipagem e build de produção passaram com Node.js 24.
Uma verificação HTTP em modo de produção confirmou o resultado da procedure no HTML inicial, `Cache-Control` com `no-store`, a consulta pelo cliente tRPC e o erro `NOT_FOUND` para uma procedure inexistente.

Na instalação inicial, `npm audit --omit=dev` não apontou vulnerabilidades. A auditoria completa ainda reportou 14 alertas moderados na cadeia de desenvolvimento do ESLint, relacionados ao minimatch. O npm também sinaliza que ESLint 9 está fora de suporte; ele foi mantido por compatibilidade com `eslint-config-next` 15. Não foi aplicado um override de versão principal ou `npm audit fix --force`, que poderia quebrar a compatibilidade. Esses pontos devem ser reavaliados quando houver atualizações compatíveis.

## Próximas etapas

Ainda não foram implementados o modelo de tarefa, armazenamento, CRUD ou formulários.
O armazenamento será compartilhado entre o caller e as procedures HTTP dentro de uma única instância Node.js. Não haverá persistência entre reinicializações nem compartilhamento entre processos.

Após as mutações, a estratégia prevista é `router.refresh()`. Sua atualização efetiva será verificada quando o CRUD existir.

Os testes de domínio cobrirão títulos vazios, IDs inexistentes e preservação da data de criação. Também será verificado que a listagem aparece no HTML inicial.

As respostas teóricas serão preparadas em inglês em uma etapa posterior.
