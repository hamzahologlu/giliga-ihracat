# Cihazlar arası senkronizasyon (Supabase) kurulumu

Verilerin farklı cihazlarda aynı kalması için Supabase kullanılıyor. Ücretsiz hesap yeterlidir.

## 1. Supabase projesi oluşturma

1. [supabase.com](https://supabase.com) → **Start your project** → GitHub ile giriş.
2. **New project** → Organization seçin, proje adı (örn. `giliga-ihracat`), şifre belirleyin → **Create**.

## 2. Veritabanı tablosu (SQL’i çalıştırma)

Proje açıldıktan sonra tabloyu ve güvenlik kurallarını oluşturmak için SQL çalıştırmanız gerekir:

1. Supabase projenizin sayfasındayken **sol taraftaki menüye** bakın.
2. **"SQL Editor"** yazana tıklayın (ikonu genelde bir terminal/komut simgesidir).
3. Sağ üstte **"New query"** (Yeni sorgu) butonuna tıklayın.
4. Açılan büyük metin kutusuna **aşağıdaki SQL kodunun tamamını** kopyalayıp yapıştırın.
5. Sağ altta veya sorgu kutusunun yanındaki **"Run"** (veya **▶ Run**) butonuna tıklayın.
6. Altta **"Success. No rows returned"** benzeri bir mesaj görürseniz işlem tamamdır.

Bunu yapmadan "Giriş yap" özelliği veritabanına yazamaz; SQL’i mutlaka bir kez çalıştırın.

```sql
create table if not exists takip_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table takip_data enable row level security;

drop policy if exists "Users can read own takip_data" on takip_data;
create policy "Users can read own takip_data" on takip_data for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own takip_data" on takip_data;
create policy "Users can insert own takip_data" on takip_data for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own takip_data" on takip_data;
create policy "Users can update own takip_data" on takip_data for update using (auth.uid() = user_id);
```

## 3. URL ve anon key alma

Sol menü **Project Settings** (dişli) → **API**:
- **Project URL** → kopyalayın.
- **anon public** key → kopyalayın.

## 4. Projede config dosyası

1. Bu klasörde `supabase-config.example.js` dosyasını kopyalayıp **supabase-config.js** adıyla kaydedin.
2. İçinde `window.SUPABASE_URL` ve `window.SUPABASE_ANON_KEY` değerlerini Supabase’den kopyaladığınız URL ve anon key ile değiştirin.

**Önemli:** `supabase-config.js` dosyasını Git’e eklemeyin (içinde anahtar var). `.gitignore` içinde zaten yoksa şunu ekleyin: `supabase-config.js`

## 5. Tek kullanıcı ve giriş ayarları

Uygulama **sadece giriş** destekler; kayıt yoktur. Tek bir kullanıcı ile çalışır:

1. **Kullanıcı oluşturma:** **Authentication** → **Users** → **Add user** → E-posta ve şifre girin → **Create user**.
2. **Kayıt kapatma:** **Authentication** → **Providers** → **Email** → **Enable Sign Up** kapalı yapın (yeni kullanıcı kaydı engellenir).
3. **E-posta onayını kapatma:** **Confirm email** kapalı yapın (e-posta doğrulama linki istemez).

## 6. Vercel’de canlı sitede “Giriş yap” çıkması

Site Vercel’de yayındaysa (örn. giliga-ihracat.vercel.app), “Giriş yap” butonunun görünmesi için Supabase bilgilerini **Vercel ortam değişkenleri** olarak ekleyin:

1. [vercel.com](https://vercel.com) → Projenize girin (giliga-ihracat) → **Settings** → **Environment Variables**.
2. Şu iki değişkeni ekleyin:
   - **Name:** `SUPABASE_URL` → **Value:** `https://opmysolrfaclzxippayh.supabase.co` (kendi Project URL’iniz)
   - **Name:** `SUPABASE_ANON_KEY` → **Value:** Supabase’ten kopyaladığınız Publishable key (`sb_publishable_...`)
3. **Save** deyip bir **yeniden deploy** alın (Deployments → son deploy’un sağındaki üç nokta → **Redeploy**).

Build sırasında bu değerlerle `supabase-config.js` oluşturulur; canlı sitede “Giriş yap” görünür.

---

Kurulumdan sonra sitede "Giriş yap" / "Kayıt ol" görünür. Aynı hesapla giriş yaptığınız her cihazda verileriniz senkronize olur.
