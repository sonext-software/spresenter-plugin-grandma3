// Plugin GrandMA3 (thread de lógica).
//
// Registra nós de automação para controlar um console GrandMA3 via OSC. A
// conexão (host/porta/prefixo) é configurada no painel e compartilhada por
// todos os nós; cada nó pode sobrescrever host/porta.
//
// Requer `background: true` no manifest para os nós existirem já no boot, mesmo
// sem o painel aberto.

import {
  targetFields,
  resolveTarget,
  interpolate,
  sendCmd,
  sendOscFloat,
  sleep,
  getSettings,
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_PREFIX,
} from './grandma3';

// ── Categoria própria no menu "adicionar nó" ────────────────────────────────
spresenter.automation.registerCategory({ key: 'grandma3', label: 'GrandMA3', icon: 'lightbulb' });

// ── 1. Linha de comando (universal) ─────────────────────────────────────────
spresenter.automation.registerNode({
  id: 'cmd',
  name: 'GrandMA3: Linha de comando',
  description:
    'Envia uma linha de comando do console via OSC /cmd (ex.: "Go+ Sequence 1", "Off Executor 201", "Store"). Aceita {variáveis} do payload.',
  category: 'grandma3',
  config: {
    command: {
      type: 'string',
      label: 'Comando',
      default: '',
      hint: 'Linha de comando do GrandMA3. Aceita {variáveis} do payload.',
    },
    ...targetFields,
  },
  execute: async (payload, config) => {
    const conn = await resolveTarget(config, payload);
    const command = interpolate(config?.command ?? '', payload);
    await sendCmd(conn, command);
  },
});

// ── 2. Executor (Go+/Go-/Pause/Off/Flash/Top/On) ────────────────────────────
spresenter.automation.registerNode({
  id: 'executor',
  name: 'GrandMA3: Executor',
  description: 'Aciona um botão de executor (Go+, Go-, Pause, Off, Flash, Top, On).',
  category: 'grandma3',
  config: {
    action: {
      type: 'select',
      label: 'Ação',
      default: 'Go+',
      options: [
        { value: 'Go+', label: 'Go+' },
        { value: 'Go-', label: 'Go-' },
        { value: 'Pause', label: 'Pause' },
        { value: 'Off', label: 'Off' },
        { value: 'Flash', label: 'Flash (On)' },
        { value: 'Top', label: 'Top' },
        { value: 'On', label: 'On' },
      ],
    },
    page: { type: 'number', label: 'Página', default: 1, hint: 'Número da página de executores' },
    executor: { type: 'number', label: 'Executor', default: 201, hint: 'Número do executor' },
    ...targetFields,
  },
  execute: async (payload, config) => {
    const conn = await resolveTarget(config, payload);
    const action = String(config?.action ?? 'Go+');
    const page = interpolate(config?.page ?? 1, payload).trim() || '1';
    const executor = interpolate(config?.executor ?? 201, payload).trim();
    if (!executor) {
      console.warn('[GrandMA3] executor vazio — envio ignorado.');
      return;
    }
    await sendCmd(conn, `${action} Executor ${page}.${executor}`);
  },
});

// ── 3. Fader de executor (nível + fade) ─────────────────────────────────────
spresenter.automation.registerNode({
  id: 'fader',
  name: 'GrandMA3: Fader',
  description:
    'Ajusta o fader de um executor (0–100%), com fade opcional. Usa um endereço OSC de fader (padrão /Page{page}/Fader{executor}).',
  category: 'grandma3',
  config: {
    page: { type: 'number', label: 'Página', default: 1 },
    executor: { type: 'number', label: 'Executor', default: 201 },
    level: { type: 'number', label: 'Nível (0–100)', default: 100, hint: '0 a 100 (%)' },
    fadeMs: {
      type: 'number',
      label: 'Fade (ms)',
      default: 0,
      hint: '0 = imediato. >0 interpola do nível inicial até o nível alvo.',
    },
    fromLevel: {
      type: 'number',
      label: 'Nível inicial do fade',
      default: 0,
      hint: 'Usado apenas quando Fade (ms) > 0',
    },
    valueRange: {
      type: 'select',
      label: 'Faixa do valor OSC',
      default: '0-1',
      options: [
        { value: '0-1', label: '0.0 – 1.0 (normalizado)' },
        { value: '0-100', label: '0 – 100 (bruto)' },
      ],
    },
    addressTemplate: {
      type: 'string',
      label: 'Endereço OSC do fader',
      default: '/Page{page}/Fader{executor}',
      hint: 'Use {page} e {executor}. Depende do mapeamento OSC do console.',
    },
    ...targetFields,
  },
  execute: async (payload, config) => {
    const conn = await resolveTarget(config, payload);
    const page = interpolate(config?.page ?? 1, payload).trim() || '1';
    const executor = interpolate(config?.executor ?? 201, payload).trim() || '201';

    // Endereço: substitui {page}/{executor}, depois aplica {variáveis} do payload.
    let addr = String(config?.addressTemplate ?? '/Page{page}/Fader{executor}');
    addr = addr.replace(/\{page\}/g, page).replace(/\{executor\}/g, executor);
    addr = interpolate(addr, payload);

    const range = String(config?.valueRange ?? '0-1');
    const scale = (lvl: number): number => {
      const clamped = Math.max(0, Math.min(100, lvl));
      return range === '0-100' ? clamped : clamped / 100;
    };

    const target = Number(interpolate(config?.level ?? 100, payload)) || 0;
    const fadeMs = Number(config?.fadeMs ?? 0) || 0;

    if (fadeMs <= 0) {
      await sendOscFloat(conn, addr, scale(target));
      return;
    }

    const from = Number(config?.fromLevel ?? 0) || 0;
    const steps = 30;
    const delay = fadeMs / steps;
    for (let i = 0; i <= steps; i++) {
      const lvl = from + (target - from) * (i / steps);
      await sendOscFloat(conn, addr, scale(lvl));
      if (i < steps) await sleep(delay);
    }
  },
});

// ── 4. Macro ────────────────────────────────────────────────────────────────
spresenter.automation.registerNode({
  id: 'macro',
  name: 'GrandMA3: Macro',
  description: 'Executa uma macro do console pelo número (comando "Macro <n>").',
  category: 'grandma3',
  config: {
    macro: { type: 'number', label: 'Macro', default: 1, hint: 'Número da macro' },
    ...targetFields,
  },
  execute: async (payload, config) => {
    const conn = await resolveTarget(config, payload);
    const macro = interpolate(config?.macro ?? 1, payload).trim();
    if (!macro) {
      console.warn('[GrandMA3] número de macro vazio — envio ignorado.');
      return;
    }
    await sendCmd(conn, `Macro ${macro}`);
  },
});

// ── 5. Sequence (Go+/Go-/Off/Pause) ─────────────────────────────────────────
spresenter.automation.registerNode({
  id: 'sequence',
  name: 'GrandMA3: Sequence',
  description: 'Aciona uma sequence pelo número (Go+, Go-, Off, Pause).',
  category: 'grandma3',
  config: {
    action: {
      type: 'select',
      label: 'Ação',
      default: 'Go+',
      options: [
        { value: 'Go+', label: 'Go+' },
        { value: 'Go-', label: 'Go-' },
        { value: 'Off', label: 'Off' },
        { value: 'Pause', label: 'Pause' },
      ],
    },
    sequence: { type: 'number', label: 'Sequence', default: 1, hint: 'Número da sequence' },
    ...targetFields,
  },
  execute: async (payload, config) => {
    const conn = await resolveTarget(config, payload);
    const action = String(config?.action ?? 'Go+');
    const sequence = interpolate(config?.sequence ?? 1, payload).trim();
    if (!sequence) {
      console.warn('[GrandMA3] número de sequence vazio — envio ignorado.');
      return;
    }
    await sendCmd(conn, `${action} Sequence ${sequence}`);
  },
});

// ── Ponte com o painel (UI) ──────────────────────────────────────────────────
// Toda ação privilegiada roda aqui; o painel só troca mensagens.
spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as {
    type?: string;
    host?: string;
    port?: string;
    prefix?: string;
    command?: string;
  };
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'get-settings') {
    const s = await getSettings();
    spresenter.ui.postMessage({
      type: 'settings',
      host: s.host,
      port: String(s.port),
      prefix: s.prefix,
    });
    return;
  }

  if (msg.type === 'save-settings') {
    const host = (msg.host ?? DEFAULT_HOST).trim();
    const port = (msg.port ?? DEFAULT_PORT).trim() || DEFAULT_PORT;
    const prefix = (msg.prefix ?? DEFAULT_PREFIX).trim();
    await spresenter.storage.set('host', host);
    await spresenter.storage.set('port', port);
    await spresenter.storage.set('prefix', prefix);
    spresenter.ui.postMessage({ type: 'settings', host, port, prefix });
    return;
  }

  if (msg.type === 'test') {
    // Envia um comando de teste com a conexão informada (ou a salva). OSC/UDP é
    // fire-and-forget: "enviado" confirma só o envio local, não a entrega.
    const s = await getSettings();
    const host = (msg.host ?? '').trim() || s.host;
    const port = Number((msg.port ?? '').trim() || s.port) || s.port;
    const prefix = (msg.prefix ?? '').trim() || s.prefix;
    const command = (msg.command ?? '').trim();
    if (!host) {
      spresenter.ui.postMessage({ type: 'test-result', ok: false, error: 'Host não configurado.' });
      return;
    }
    if (!command) {
      spresenter.ui.postMessage({ type: 'test-result', ok: false, error: 'Digite um comando de teste.' });
      return;
    }
    try {
      await sendCmd({ host, port, prefix }, command);
      spresenter.ui.postMessage({ type: 'test-result', ok: true });
    } catch (err) {
      spresenter.ui.postMessage({ type: 'test-result', ok: false, error: String(err) });
    }
    return;
  }
};

// eslint-disable-next-line no-console
console.log('Plugin GrandMA3 carregado:', spresenter.manifest.name);
