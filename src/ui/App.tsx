import { useEffect, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import {
  Root,
  Header,
  Panel,
  Stack,
  Row,
  Field,
  TextInput,
  Button,
  Actions,
  Alert,
  Footer,
} from '@spresenter/plugin-sdk/ui-kit/react';

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

  return (
    <Root>
      <Header
        title="GrandMA3"
        subtitle="Host, porta e prefixo OSC padrão usados pelos nós de automação GrandMA3."
      />

      <Stack>
        <Field label="Host (IP do console)">
          <TextInput
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.0.10"
          />
        </Field>
        <Row>
          <Field label="Porta OSC">
            <TextInput
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8000"
            />
          </Field>
          <Field label="Prefixo (opcional)">
            <TextInput
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="(nenhum)"
            />
          </Field>
        </Row>
      </Stack>

      <Actions>
        <Button variant="primary" onClick={save}>
          {saved ? 'Salvo ✓' : 'Salvar'}
        </Button>
      </Actions>

      <Panel label="Testar comando">
        <Row>
          <Field label="Comando">
            <TextInput
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Go+ Sequence 1"
            />
          </Field>
          <Button
            onClick={runTest}
            disabled={testing}
            style={{ alignSelf: 'flex-end' }}
          >
            {testing ? 'Enviando…' : 'Enviar'}
          </Button>
        </Row>
        {test && (
          <Alert variant={test.ok ? 'success' : 'error'}>
            {test.ok
              ? 'Comando enviado ✓ (OSC/UDP não confirma entrega — verifique no console)'
              : `Falha ao enviar${test.error ? `: ${test.error}` : ''}.`}
          </Alert>
        )}
      </Panel>

      <Footer>
        No GrandMA3: habilite uma entrada{' '}
        <span style={{ color: 'var(--sp-text-muted)' }}>OSC</span> (porta 8000) e o
        roteamento de{' '}
        <span style={{ color: 'var(--sp-text-muted)' }}>/cmd</span> para a linha de
        comando.
      </Footer>
    </Root>
  );
}
