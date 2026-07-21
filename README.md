# GrandMA3 — plugin Spresenter

Registra nós de automação para controlar um console **GrandMA3** (MA Lighting) pela
rede, via **OSC** (Open Sound Control).

## Como o GrandMA3 é controlado

O GrandMA3 é 100% baseado em **OSC** para controle remoto (o servidor Telnet/remote
key do MA2 foi descontinuado). Este plugin envia OSC sobre **UDP** (porta padrão
**8000**). O caminho universal é o endereço **`/cmd`** com um argumento _string_ = a
linha de comando do console — assim qualquer ação que você faria no console pode ser
disparada por automação.

### Pré-requisitos no console

1. Habilite uma entrada **OSC** no GrandMA3 (Menu → Network / Remote Inputs → OSC),
   escutando na porta **8000** (ou a que você configurar no painel do plugin).
2. Garanta que o endereço **`/cmd`** esteja roteado para a **linha de comando**. Se
   você usar um **prefixo** de OSC no console, informe o mesmo prefixo no painel.
3. O PC do Spresenter e o console precisam estar na mesma rede.

> OSC/UDP é _fire-and-forget_: não há confirmação de entrega. O botão "Enviar" do
> painel confirma apenas que o datagrama saiu, não que o console o recebeu.

## Nós disponíveis (categoria "GrandMA3")

| Nó | O que faz |
|----|-----------|
| **Linha de comando** | Envia qualquer linha de comando via `/cmd` (ex.: `Go+ Sequence 1`, `Off Executor 201`, `Store`). Escape hatch universal. |
| **Executor** | Aciona um botão de executor (Go+, Go-, Pause, Off, Flash, Top, On) por página.número. |
| **Fader** | Ajusta o fader de um executor (0–100%), com _fade_ opcional, via endereço OSC de fader. |
| **Macro** | Executa uma macro pelo número (`Macro <n>`). |
| **Sequence** | Aciona uma sequence pelo número (Go+, Go-, Off, Pause). |

Os nós **Executor**, **Macro** e **Sequence** montam uma linha de comando e enviam
por `/cmd` — robusto entre versões do MA3. Se algum verbo não existir na sua versão,
use o nó **Linha de comando** com a sintaxe exata do seu console.

O nó **Fader** usa um **endereço OSC próprio** (padrão `/Page{page}/Fader{executor}`),
pois faders dependem do mapeamento OSC configurado no console — ajuste o template e a
faixa de valor (`0.0–1.0` ou `0–100`) conforme sua configuração. Alternativa: a
linha de comando (`Executor <page>.<exec> At <nível>`).

Cada nó tem campos opcionais **Host** e **Porta**; em branco, usam o padrão do painel.
Todos os campos aceitam `{variáveis}` do payload do gatilho.

## Painel

O painel "GrandMA3" (Configurações → Plugins) define **host / porta / prefixo** padrão
e permite **enviar um comando de teste**.

## Desenvolvimento

```bash
npm install
npm run build        # gera dist/code.js + dist/ui
npm run dev          # watch (code + ui)
```

Carregue em **Configurações → Plugins → Carregar pasta (dev)** apontando para esta
pasta. Para distribuir: `npm run package` (gera `release/<id>-<version>.zip`).

> Este plugin depende do método `spresenter.net.oscSend` do SDK (escopo `net:connect`),
> introduzido junto com ele no app. O SDK é referenciado por
> `file:sdk/spresenter-plugin-sdk.tgz` — o tarball é gerado pelo script do app
> `.erb/scripts/build-sdk.js` (`npm run build:sdk` na raiz do app).
