# Ensaios · Controle de Pavimentação

Aplicativo web para controle tecnológico de obras de pavimentação (padrão
**GOINFRA / DNIT / DNER**). Você informa **o que foi produzido no dia** e o
sistema diz **quais ensaios precisa fazer, quantos e onde** (estaqueamento),
cruzando com o que já foi feito antes.

> **Onde ficam os dados?** Tudo é salvo **no seu navegador** (IndexedDB) —
> funciona offline, é privado e permanece entre sessões. Nada sobe para
> servidores. Há backup/exportação para você guardar cópias.

## Status por etapas

| # | Etapa | Situação |
|---|-------|----------|
| 0 | Base do projeto (Vite + React + TS + Tailwind + Dexie) | ✅ |
| 1 | Importação e parsing do checklist `.xlsx` | ✅ |
| 2 | Lançamento de produção diária | ⏳ |
| 3 | Motor de cálculo de ensaios exigidos | ⏳ |
| 4 | Checklist diário interativo | ⏳ |
| 5 | Histórico e indicador de aderência | ⏳ |
| 6 | Exportação Excel/CSV + backup | ⏳ |
| 7 | Refino visual + deploy (GitHub Pages) | ⏳ |

## Como funciona a importação (Etapa 1)

- Uma **aba por material/serviço** (BASE, IMPRIMAÇÃO, CAUQ, TSD, TSS, CONCRETO,
  RESTAURAÇÃO, PINTURA DE LIGAÇÃO, AD…). As abas **PVEGQ** (relatório de
  efetividade) são reconhecidas e **ignoradas**.
- Lê as colunas **ENSAIOS/VERIFICAÇÕES**, **UND.** e **PARÂMETRO DE NORMA**.
  As colunas **Qtd. Apres** e **Qtd. de Norma** são **ignoradas** (isso vem do
  memorial de cálculo, fase futura).
- Cada frequência é classificada automaticamente em um tipo estruturado:
  `por_distancia`, `por_volume`, `por_massa`, `por_carregamento`,
  `por_jornada`, `por_mudanca_de_fonte`, `periodico_certificado`,
  `visual_obrigatorio`, `combinado` ou `outro` (texto preservado para
  classificação manual).
- Cada **obra** tem seu próprio checklist e histórico. Reimportar o checklist
  **atualiza as regras sem apagar** a produção lançada.

## Rodar localmente

```bash
npm install
npm run dev      # ambiente de desenvolvimento
npm run build    # build de produção (pasta dist/)
npm run preview  # servir o build
```

## Arquitetura (resumo)

- **Front-end:** React + TypeScript + Vite, estilo visual azul/branco (iOS).
- **Persistência:** IndexedDB via Dexie (`src/db.ts`).
- **Parsing de planilha:** SheetJS (`src/lib/xlsxImport.ts`).
- **Classificador de frequências:** função pura testável
  (`src/lib/frequencia.ts`).
- **Aritmética de estacas:** 1 estaca = 20 m (`src/lib/estacas.ts`).

Estrutura de dados pensada para, no futuro, conectar com o **memorial de
cálculo** e atualizar sozinha as quantidades apresentadas/exigidas.
