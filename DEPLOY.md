# Giliga Toys E-İhracat Takip — Yayına Alma

Bu proje statik HTML/CSS/JS’tir. Cursor’dan (veya herhangi bir terminalden) aşağıdaki yollarla yayına alabilirsiniz.

## 1. Vercel ile (önerilen)

1. [Vercel](https://vercel.com) hesabı açın (ücretsiz).
2. Cursor’da **Terminal** açın (Ctrl+` veya Cmd+`).
3. Proje klasörüne gidip Vercel’e giriş yapın ve deploy edin:

```bash
cd /Users/seoting/e-ihracat-destekleri-takip
npx vercel
```

4. Soruldukça:
   - **Set up and deploy?** → Yes
   - **Which scope?** → Kendi hesabınız
   - **Link to existing project?** → No
   - **Project name?** → Örn: `giliga-e-ihracat` (Enter)
   - **In which directory is your code?** → `./` (Enter)

5. Deploy bitince size bir URL verilir (örn: `giliga-e-ihracat.vercel.app`). Sonraki deploy’lar için yine aynı klasörde `npx vercel --prod` çalıştırmanız yeterli.

---

## 2. Netlify ile

1. [Netlify](https://netlify.com) hesabı açın.
2. Terminalde:

```bash
cd /Users/seoting/e-ihracat-destekleri-takip
npx netlify-cli deploy --prod --dir=.
```

3. İlk seferde tarayıcıdan giriş isteyebilir; giriş yaptıktan sonra komutu tekrar çalıştırın.

---

## 3. GitHub + Vercel/Netlify (otomatik deploy)

1. Bu klasörde git başlatıp GitHub’a push edin:

```bash
cd /Users/seoting/e-ihracat-destekleri-takip
git init
git add .
git commit -m "Giliga Toys E-İhracat takip sitesi"
```

2. GitHub’da yeni bir repo oluşturup (örn. `giliga-e-ihracat`) remote ekleyin ve push edin.
3. Vercel veya Netlify’da “Import project” → GitHub repo’yu seçin. Her push’ta otomatik yayına alınır.

---

**Not:** Veriler (tamamlanan maddeler, notlar) tarayıcıda **localStorage**’da tutulur; sunucuya gitmez. Farklı cihazda aynı ilerleme görünmez; sadece o cihazın tarayıcısında kalır.
