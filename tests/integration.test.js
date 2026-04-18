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
  const text = encodeURIComponent(`✅ *Teste de integração — ${now}*\nSite Letícia & Paulo funcionando corretamente.`);
  const url  = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${text}&apikey=${APIKEY}`;

  console.log(`  📲 Enviando para +${PHONE}...`);

  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`  ✅ WhatsApp enviado com sucesso (HTTP ${res.status})`);
      console.log(`  📱 Verifique seu WhatsApp no número +${PHONE}\n`);
    } else {
      console.error(`  ❌ CallMeBot retornou HTTP ${res.status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`  ❌ Erro de rede: ${e.message}\n`);
    process.exit(1);
  }
})();
