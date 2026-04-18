const assert = require('assert');

// ── Mock de req/res ──────────────────────────────────────────────
function mockRes() {
  const res = {
    _status: null, _body: null, _headers: {},
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body;   return this; },
    end()        { return this; },
    setHeader(k, v) { this._headers[k] = v; }
  };
  return res;
}

// ── Stubs de ambiente ────────────────────────────────────────────
function setEnv(overrides = {}) {
  process.env.SUPABASE_URL        = overrides.SUPABASE_URL        ?? 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = overrides.SUPABASE_SERVICE_KEY ?? 'fake-key';
  process.env.CALLMEBOT_APIKEY    = overrides.CALLMEBOT_APIKEY    ?? '';
  process.env.NOTIFY_PHONE        = overrides.NOTIFY_PHONE        ?? '';
}

// ── Mock do módulo Supabase ──────────────────────────────────────
let supabaseInsertResult = { error: null };
require.cache[require.resolve('@supabase/supabase-js')] = {
  id: require.resolve('@supabase/supabase-js'),
  filename: require.resolve('@supabase/supabase-js'),
  loaded: true,
  exports: {
    createClient: () => ({
      from: () => ({
        insert: async () => supabaseInsertResult
      })
    })
  }
};

// ── Mock global do fetch (CallMeBot) ────────────────────────────
let fetchCalls = [];
let fetchShouldFail = false;

global.fetch = async (url) => {
  fetchCalls.push(url);
  if (fetchShouldFail) throw new Error('network error');
  return { status: 200 };
};

// Recarrega o handler sem cache para pegar o fetch mockado
delete require.cache[require.resolve('../api/rsvp')];
const handler = require('../api/rsvp');

// ── Helpers ──────────────────────────────────────────────────────
function resetFetch() { fetchCalls = []; fetchShouldFail = false; }

async function run(body, envOverrides) {
  setEnv(envOverrides);
  const req = { method: 'POST', body };
  const res = mockRes();
  await handler(req, res);
  return res;
}

// ═══════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌  ${name}`);
    console.error(`      ${e.message}`);
    failed++;
  }
}

(async () => {
  console.log('\n── /api/rsvp ───────────────────────────────────────────\n');

  // 1. OPTIONS retorna 200
  await test('OPTIONS request retorna 200', async () => {
    setEnv();
    const req = { method: 'OPTIONS', body: {} };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res._status, 200);
  });

  // 2. Método não permitido
  await test('GET request retorna 405', async () => {
    setEnv();
    const req = { method: 'GET', body: {} };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res._status, 405);
  });

  // 3. Nome ausente retorna 400
  await test('Body sem nome retorna 400', async () => {
    const res = await run({ presenca: 'sim' });
    assert.strictEqual(res._status, 400);
    assert.ok(res._body.error);
  });

  // 4. SUPABASE_URL ausente retorna 500
  await test('Sem SUPABASE_URL retorna 500', async () => {
    const res = await run({ nome: 'Teste', presenca: 'sim' }, { SUPABASE_URL: '', SUPABASE_SERVICE_KEY: 'k' });
    assert.strictEqual(res._status, 500);
  });

  // 5. Confirmação válida retorna 200
  await test('Confirmação válida retorna 200', async () => {
    supabaseInsertResult = { error: null };
    const res = await run({ nome: 'João Silva', acompanhantes: '1', presenca: 'sim', mensagem: 'Ansiosos!' });
    assert.strictEqual(res._status, 200);
    assert.strictEqual(res._body.ok, true);
  });

  // 6. Recusa também retorna 200
  await test('Recusa (presenca=nao) retorna 200', async () => {
    supabaseInsertResult = { error: null };
    const res = await run({ nome: 'Maria', acompanhantes: '0', presenca: 'nao' });
    assert.strictEqual(res._status, 200);
    assert.strictEqual(res._body.ok, true);
  });

  // 7. Erro do Supabase retorna 500
  await test('Erro do Supabase retorna 500', async () => {
    supabaseInsertResult = { error: { message: 'db error' } };
    const res = await run({ nome: 'Ana', presenca: 'sim' });
    assert.strictEqual(res._status, 500);
    supabaseInsertResult = { error: null };
  });

  // 8. CORS headers presentes
  await test('Headers CORS presentes', async () => {
    supabaseInsertResult = { error: null };
    const res = await run({ nome: 'Carlos', presenca: 'sim' });
    assert.strictEqual(res._headers['Access-Control-Allow-Origin'], '*');
  });

  // 9. Body sem campo mensagem não quebra
  await test('Mensagem opcional (undefined) não quebra', async () => {
    supabaseInsertResult = { error: null };
    const res = await run({ nome: 'Pedro', acompanhantes: '0', presenca: 'sim' });
    assert.strictEqual(res._status, 200);
  });

  // 10. Body nulo não quebra
  await test('Body nulo retorna 400 sem exceção', async () => {
    setEnv();
    const req = { method: 'POST', body: null };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res._status, 400);
  });

  // ── WhatsApp (CallMeBot) ────────────────────────────────────────
  console.log('\n── WhatsApp / CallMeBot ────────────────────────────────\n');

  // 11. Dispara fetch para CallMeBot quando variáveis presentes
  await test('Dispara fetch para CallMeBot ao confirmar presença', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Letícia', acompanhantes: '1', presenca: 'sim', mensagem: 'Feliz!' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '5511984362736' }
    );
    assert.strictEqual(fetchCalls.length, 1, 'fetch deve ser chamado exatamente 1 vez');
    assert.ok(fetchCalls[0].includes('api.callmebot.com'), 'URL deve ser do CallMeBot');
  });

  // 12. URL contém phone, apikey e texto codificado
  await test('URL do CallMeBot contém phone, apikey e nome do convidado', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Paulo Noivo', acompanhantes: '0', presenca: 'sim' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '5511984362736' }
    );
    const url = fetchCalls[0];
    assert.ok(url.includes('phone=5511984362736'), 'URL deve conter o telefone');
    assert.ok(url.includes('apikey=4447555'),       'URL deve conter o apikey');
    assert.ok(url.includes('Paulo'),                'URL deve conter o nome');
  });

  // 13. Não dispara fetch quando CALLMEBOT_APIKEY ausente
  await test('Não dispara WhatsApp se CALLMEBOT_APIKEY estiver vazio', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Ana', presenca: 'sim' },
      { CALLMEBOT_APIKEY: '', NOTIFY_PHONE: '5511984362736' }
    );
    assert.strictEqual(fetchCalls.length, 0, 'fetch não deve ser chamado sem apikey');
  });

  // 14. Não dispara fetch quando NOTIFY_PHONE ausente
  await test('Não dispara WhatsApp se NOTIFY_PHONE estiver vazio', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Carlos', presenca: 'sim' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '' }
    );
    assert.strictEqual(fetchCalls.length, 0, 'fetch não deve ser chamado sem telefone');
  });

  // 15. Falha no CallMeBot não retorna erro para o cliente
  await test('Falha no CallMeBot não impede retorno 200', async () => {
    resetFetch();
    fetchShouldFail = true;
    supabaseInsertResult = { error: null };
    const res = await run(
      { nome: 'Roberto', presenca: 'sim' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '5511984362736' }
    );
    assert.strictEqual(res._status, 200, 'deve retornar 200 mesmo com falha no WhatsApp');
    assert.strictEqual(res._body.ok, true);
    resetFetch();
  });

  // 16. Mensagem de recusa não contém total de pessoas
  await test('Mensagem de recusa não inclui contagem de acompanhantes', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Marcos', acompanhantes: '2', presenca: 'nao' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '5511984362736' }
    );
    const url = decodeURIComponent(fetchCalls[0]);
    assert.ok(url.includes('NAO'), 'deve indicar recusa');
    assert.ok(!url.includes('Total: 3'), 'não deve mostrar total em recusa');
  });

  // 17. Mensagem de confirmação inclui total correto
  await test('Mensagem de confirmação inclui total de pessoas correto', async () => {
    resetFetch();
    supabaseInsertResult = { error: null };
    await run(
      { nome: 'Fernanda', acompanhantes: '2', presenca: 'sim' },
      { CALLMEBOT_APIKEY: '4447555', NOTIFY_PHONE: '5511984362736' }
    );
    const url = decodeURIComponent(fetchCalls[0]);
    assert.ok(url.includes('3 pessoa'), 'deve mostrar total = 1 + 2 = 3');
  });

  console.log(`\n── Resultado: ${passed} passou · ${failed} falhou ─────────────\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
