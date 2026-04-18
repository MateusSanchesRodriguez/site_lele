# Site Letícia & Paulo — Setup

## 1. Supabase (banco de dados)

1. Acesse https://supabase.com e crie um projeto grátis
2. No SQL Editor, rode:

```sql
create table rsvps (
  id          bigint generated always as identity primary key,
  nome        text not null,
  acompanhantes int default 0,
  presenca    text not null,
  mensagem    text,
  created_at  timestamptz default now()
);
```

3. Em **Settings → API** copie:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_KEY`

---

## 2. CallMeBot (WhatsApp grátis)

1. Salve o número **+34 644 44 21 27** nos contatos do WhatsApp
2. Envie a mensagem: `I allow callmebot to send me messages`
3. Você receberá seu `apikey` em poucos segundos

---

## 3. Variáveis de ambiente na Vercel

No painel da Vercel → **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJxx...` |
| `CALLMEBOT_APIKEY` | seu apikey do CallMeBot |
| `NOTIFY_PHONE` | `5511984362736` |

---

## 4. Deploy

```bash
vercel --prod
```

Ou conecte o repositório GitHub na Vercel e o deploy é automático a cada push.
