const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[RSVP] body recebido:', JSON.stringify(req.body));

  const { nome, acompanhantes, presenca, mensagem } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  // ── Variáveis de ambiente ──
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const callmebotKey = process.env.CALLMEBOT_APIKEY;
  const notifyPhone  = process.env.NOTIFY_PHONE;

  console.log('[RSVP] env check — SUPABASE_URL:', !!supabaseUrl, '| SERVICE_KEY:', !!supabaseKey, '| CALLMEBOT:', !!callmebotKey, '| PHONE:', !!notifyPhone);

  if (!supabaseUrl || !supabaseKey) {
    console.error('[RSVP] variáveis do Supabase ausentes');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  // ── Salva no Supabase ──
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: dbError } = await supabase.from('rsvps').insert({
      nome,
      acompanhantes: parseInt(acompanhantes) || 0,
      presenca,
      mensagem: mensagem || null
    });

    if (dbError) {
      console.error('[RSVP] Supabase error:', JSON.stringify(dbError));
      return res.status(500).json({ error: 'Erro ao salvar no banco', detail: dbError.message });
    }
    console.log('[RSVP] salvo no Supabase com sucesso');
  } catch (e) {
    console.error('[RSVP] Supabase exception:', e.message);
    return res.status(500).json({ error: 'Exceção ao conectar no banco', detail: e.message });
  }

  // ── Dispara WhatsApp via CallMeBot ──
  try {
    if (callmebotKey && notifyPhone) {
      const total  = 1 + (parseInt(acompanhantes) || 0);
      const status = presenca === 'sim'
        ? `CONFIRMOU presenca - Total: ${total} pessoa(s)`
        : 'NAO podera comparecer';
      const extra = mensagem ? ` - Msg: "${mensagem}"` : '';
      const text  = encodeURIComponent(`Leticia & Paulo 23/10/2026 - ${nome} ${status}${extra}`);
      const url   = `https://api.callmebot.com/whatsapp.php?phone=${notifyPhone}&text=${text}&apikey=${callmebotKey}`;

      console.log('[RSVP] disparando WhatsApp para', notifyPhone);
      const waRes = await fetch(url);
      console.log('[RSVP] CallMeBot status:', waRes.status);
    } else {
      console.warn('[RSVP] WhatsApp pulado — variáveis ausentes');
    }
  } catch (e) {
    console.error('[RSVP] WhatsApp exception:', e.message);
  }

  return res.status(200).json({ ok: true });
};
