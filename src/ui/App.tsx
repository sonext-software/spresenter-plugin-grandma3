import { useEffect, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';

// Painel de conexão do GrandMA3. Toda ação privilegiada (OSC/UDP) roda na
// thread de lógica (code.ts); aqui só trocamos mensagens.

type TestResult = { ok: boolean; error?: string };

export function App() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8000');
  const [prefix, setPrefix] = useState('');
  const [command, setCommand] = useState('Go+ Sequence 1');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  useEffect(() => {
    const off = onMessage((raw) => {
      const msg = raw as {
        type?: string;
        host?: string;
        port?: string;
        prefix?: string;
      } & Partial<TestResult>;
      if (msg.type === 'settings') {
        setHost(msg.host ?? '');
        if (msg.port) setPort(msg.port);
        setPrefix(msg.prefix ?? '');
      }
      if (msg.type === 'test-result') {
        setTesting(false);
        setTest({ ok: !!msg.ok, error: msg.error });
      }
    });
    postMessage({ type: 'get-settings' });
    return off;
  }, []);

  const save = () => {
    postMessage({ type: 'save-settings', host, port, prefix });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const runTest = () => {
    setTest(null);
    setTesting(true);
    postMessage({ type: 'test', host, port, prefix, command });
  };

  const inputCls =
    'w-full rounded-md bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500';
  const btnCls =
    'rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 flex flex-col gap-5">
      <header>
        <h1 className="text-lg font-semibold">GrandMA3</h1>
        <p className="text-sm text-neutral-400">
          Host, porta e prefixo OSC padrão usados pelos nós de automação GrandMA3.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Host (IP do console)</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.0.10"
            className={inputCls}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Porta OSC</span>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8000"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Prefixo (opcional)</span>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="(nenhum)"
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={save} className={`${btnCls} bg-amber-600 hover:bg-amber-500`}>
          {saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
        <span className="text-xs uppercase tracking-wide text-neutral-400">Testar comando</span>
        <div className="flex gap-2">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Go+ Sequence 1"
            className={inputCls}
          />
          <button
            onClick={runTest}
            disabled={testing}
            className={`${btnCls} bg-neutral-700 hover:bg-neutral-600 whitespace-nowrap`}
          >
            {testing ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {test && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              test.ok ? 'bg-emerald-600/20 text-emerald-200' : 'bg-red-600/20 text-red-200'
            }`}
          >
            {test.ok
              ? 'Comando enviado ✓ (OSC/UDP não confirma entrega — verifique no console)'
              : `Falha ao enviar${test.error ? `: ${test.error}` : ''}.`}
          </div>
        )}
      </div>

      <footer className="mt-auto text-xs text-neutral-500 leading-relaxed">
        No GrandMA3: habilite uma entrada <span className="text-neutral-300">OSC</span> (porta 8000)
        e o roteamento de <span className="text-neutral-300">/cmd</span> para a linha de comando.
      </footer>
    </div>
  );
}
