require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const APIKEY = process.env.CALLMEBOT_APIKEY;
const PHONE  = process.env.NOTIFY_PHONE;

if (!APIKEY || !PHONE) {
  console.error('\n❌ CALLMEBOT_APIKEY ou NOTIFY_PHONE não configurados no .env\n');
  process.exit(1);
}

(async () => {
  console.log('\n── Integração real: WhatsApp ────────────────────────────\n');

  const now  = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const text = encodeURIComponent(`Teste de integracao - ${now} - Site Leticia e Paulo OK`);
  const url  = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${text}&apikey=${APIKEY}`;

  console.log(`  📲 Enviando para +${PHONE}...`);

  try {
    const res  = await fetch(url);
    const body = await res.text();
    console.log(`  HTTP ${res.status} — resposta: ${body.trim()}`);

    if (!res.ok || body.toLowerCase().includes('error')) {
      console.error(`  ❌ CallMeBot reportou erro\n`);
      process.exit(1);
    }
    console.log(`  ✅ Mensagem enviada — verifique a conversa com +34 644 99 26 98 no WhatsApp\n`);
  } catch (e) {
    console.error(`  ❌ Erro de rede: ${e.message}\n`);
    process.exit(1);
  }
})();
