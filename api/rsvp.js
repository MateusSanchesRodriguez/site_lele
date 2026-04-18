const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, acompanhantes, presenca, mensagem } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  // ── Salva no Supabase ──
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { error: dbError } = await supabase.from('rsvps').insert({
    nome,
    acompanhantes: parseInt(acompanhantes) || 0,
    presenca,
    mensagem: mensagem || null
  });

  if (dbError) {
    console.error('Supabase error:', dbError);
    return res.status(500).json({ error: 'Erro ao salvar confirmação' });
  }

  // ── Dispara WhatsApp via CallMeBot ──
  try {
    const apiKey = process.env.CALLMEBOT_APIKEY;
    const phone  = process.env.NOTIFY_PHONE;

    if (apiKey && phone) {
      const total  = 1 + (parseInt(acompanhantes) || 0);
      const status = presenca === 'sim'
        ? `✅ CONFIRMOU presença\n👥 Total: ${total} pessoa(s)`
        : '❌ NÃO poderá comparecer';
      const extra = mensagem ? `\n💬 "${mensagem}"` : '';

      const text = encodeURIComponent(
        `🎊 *Letícia & Paulo — 23/10/2026*\n\n*${nome}* ${status}${extra}`
      );

      await fetch(
        `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apiKey}`
      );
    }
  } catch (e) {
    console.error('WhatsApp error:', e);
    // não bloqueia a resposta se o WhatsApp falhar
  }

  return res.status(200).json({ ok: true });
};
