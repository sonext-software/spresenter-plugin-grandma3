// Helpers compartilhados pelos nós GrandMA3.
//
// Conexão (host/porta/prefixo OSC) é salva no painel via `spresenter.storage`;
// cada nó pode sobrescrever host/porta. O envio real é OSC sobre UDP via
// `spresenter.net.oscSend` (exposto pelo host, escopo `net:connect`).
//
// GrandMA3 é controlado por OSC (porta padrão 8000). O caminho universal é o
// endereço `/cmd` com um argumento string = a linha de comando do console
// (ex.: "Go+ Sequence 1"). Faders usam um endereço próprio com valor float.

export const DEFAULT_HOST = '';
export const DEFAULT_PORT = '8000';
export const DEFAULT_PREFIX = '';

export interface Conn {
  host: string;
  port: number;
  prefix: string;
}

// {chave} → payload[chave]. O SDK não expõe o interpolateTemplate do app, então
// reimplementamos a interpolação simples aqui (igual ao plugin Lumikit).
export function interpolate(input: unknown, payload: any): string {
  const str = input == null ? '' : String(input);
  if (!payload || typeof payload !== 'object') return str;
  return str.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = payload[key];
    return v == null ? '' : String(v);
  });
}

// Conexão padrão definida no painel (storage do plugin).
export async function getSettings(): Promise<Conn> {
  const host = (await spresenter.storage.get<string>('host')) || DEFAULT_HOST;
  const port = (await spresenter.storage.get<string>('port')) || DEFAULT_PORT;
  const prefix = (await spresenter.storage.get<string>('prefix')) || DEFAULT_PREFIX;
  return {
    host: String(host).trim(),
    port: Number(port) || 8000,
    prefix: String(prefix).trim(),
  };
}

// Campos opcionais de host/porta por nó (sobrescrevem o padrão do painel).
// Espalhe com `...targetFields` no `config` de cada nó.
export const targetFields = {
  host: {
    type: 'string' as const,
    label: 'Host (opcional)',
    default: '',
    hint: 'Vazio = usa o host do painel GrandMA3',
  },
  port: {
    type: 'string' as const,
    label: 'Porta (opcional)',
    default: '',
    hint: 'Vazio = usa a porta do painel (padrão 8000)',
  },
};

// Resolve a conexão: override do nó (aceita {variáveis}) → padrão do painel.
export async function resolveTarget(config: any, payload: any): Promise<Conn> {
  const s = await getSettings();
  const host = interpolate(config?.host, payload).trim() || s.host;
  const portStr = interpolate(config?.port, payload).trim();
  const port = portStr ? Number(portStr) || s.port : s.port;
  return { host, port, prefix: s.prefix };
}

// Aplica o prefixo OSC do painel a um endereço, normalizando as barras.
export function withPrefix(prefix: string, address: string): string {
  const p = (prefix || '').replace(/\/+$/, '');
  const a = address.startsWith('/') ? address : `/${address}`;
  return `${p}${a}`;
}

// Envia a linha de comando do GrandMA3 via /cmd (argumento string). Loga erros
// mas NUNCA lança, para um envio falho não interromper o fluxo de automação.
export async function sendCmd(conn: Conn, command: string): Promise<void> {
  const cmd = (command || '').trim();
  if (!conn.host) {
    console.warn('[GrandMA3] host não configurado — envio ignorado. Configure no painel.');
    return;
  }
  if (!cmd) {
    console.warn('[GrandMA3] comando vazio — envio ignorado.');
    return;
  }
  const address = withPrefix(conn.prefix, '/cmd');
  try {
    await spresenter.net.oscSend(conn.host, conn.port, address, [{ type: 's', value: cmd }]);
  } catch (err) {
    console.error(
      `[GrandMA3] falha ao enviar "${cmd}" → ${conn.host}:${conn.port}${address}:`,
      err,
    );
  }
}

// Envia um valor float para um endereço OSC arbitrário (ex.: fader).
export async function sendOscFloat(conn: Conn, address: string, value: number): Promise<void> {
  if (!conn.host) {
    console.warn('[GrandMA3] host não configurado — envio ignorado. Configure no painel.');
    return;
  }
  const full = withPrefix(conn.prefix, address);
  try {
    await spresenter.net.oscSend(conn.host, conn.port, full, [{ type: 'f', value }]);
  } catch (err) {
    console.error(`[GrandMA3] falha ao enviar ${full}=${value}:`, err);
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
