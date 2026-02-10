# Git → Vercel otomatik deploy

Bu projede yaptığınız değişiklikler Git’e push edildiğinde Vercel canlı siteyi otomatik günceller.

## 1. GitHub’da repo oluşturma

1. [github.com/new](https://github.com/new) adresine gidin.
2. **Repository name:** `giliga-ihracat` (veya istediğiniz isim).
3. **Public** seçin.
4. **“Add a README file”** işaretlemeyin (projede zaten var).
5. **Create repository**’e tıklayın.

## 2. Projeyi GitHub’a gönderme

Cursor’da Terminal’de (proje klasöründe):

```bash
cd /Users/seoting/e-ihracat-destekleri-takip

# Kendi GitHub kullanıcı adınız ve repo adınızı yazın:
git remote add origin https://github.com/KULLANICI_ADINIZ/giliga-ihracat.git

git branch -M main
git push -u origin main
```

(GitHub’da repo adı farklıysa `giliga-ihracat` yerine onu yazın.)

## 3. Vercel’de Git bağlantısı

1. [vercel.com/dashboard](https://vercel.com/dashboard) → **giliga-ihracat** projesine girin.
2. Üstten **Settings** sekmesine tıklayın.
3. Sol menüden **Git** bölümüne girin.
4. **Connect Git Repository** (veya “Connect to Git”) butonuna tıklayın.
5. **GitHub** seçin, yetki verin, açılan listeden **giliga-ihracat** repo’sunu seçin.
6. **Production Branch** olarak `main` kalsın → **Save** / **Connect**.

Bundan sonra `main` branch’ine her `git push` yaptığınızda Vercel otomatik yeni bir deploy alır ve canlı site güncellenir.

## Günlük kullanım

Değişiklik yaptıktan sonra:

```bash
cd /Users/seoting/e-ihracat-destekleri-takip
git add .
git commit -m "Ne değiştirdiğinizi kısaca yazın"
git push
```

1–2 dakika içinde https://giliga-ihracat.vercel.app güncellenir.
