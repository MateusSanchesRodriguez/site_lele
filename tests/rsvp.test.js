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

const handler = require('../api/rsvp');

// ── Helpers ──────────────────────────────────────────────────────
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

  console.log(`\n── Resultado: ${passed} passou · ${failed} falhou ─────────────\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
