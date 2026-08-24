# CUMA WORLD Cloudflare Control Plane

Bu klasör oyunun gerçek-zamanlı Godot relay sunucusunun yerine geçmez. Cloudflare katmanı güvenli bir **kontrol düzlemi** sağlar:

- 6 haneli oda kodundan relay URL bulma
- Dedicated server oda kaydı + kısa ömürlü heartbeat
- Sunucu ölürse oda kaydının otomatik zaman aşımı
- Oda kodu taramasına karşı IP'yi HMAC ile anonimleştiren rate limit
- `/health` ve `/v1/config` uçları
- Oyuncu adı, sohbet metni, konum veya kişisel profil saklamama

## Secrets

Secret değerlerini repoya yazmayın. Cloudflare'da iki secret gerekir:

```bash
npx wrangler secret put CONTROL_TOKEN
npx wrangler secret put RATE_HASH_SECRET
```

- `CONTROL_TOKEN`: yalnız dedicated relay sunucusunun oda kaydı/heartbeat işlemleri için.
- `RATE_HASH_SECRET`: istemci IP'sini ham halde saklamadan rate-limit anahtarı üretmek için.

## Yerel doğrulama

```bash
npm install
npm run typecheck
npm run build
```

`npm run build`, `wrangler deploy --dry-run` kullanır; canlı ortama deploy etmez.

## Deploy

```bash
npm run deploy
```

Deploy sonrası Worker URL'sini Godot tarafında `CUMA_CONTROL_PLANE_URL` ortam değişkeni veya proje ayarı üzerinden verin. Dedicated server ayrıca `CUMA_CONTROL_TOKEN` ve dışarıdan erişilebilen `wss://...` relay URL'sini kullanır.

## API

- `GET /health`
- `GET /v1/config`
- `GET /v1/rooms/:CODE`
- `PUT /v1/rooms/:CODE` — Bearer control token
- `POST /v1/rooms/:CODE/heartbeat` — Bearer control token
- `DELETE /v1/rooms/:CODE` — Bearer control token

Oda kayıtları Durable Object storage'da kısa süreli tutulur ve alarm ile otomatik temizlenir.
