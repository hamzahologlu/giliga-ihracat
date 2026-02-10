const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

const content =
  "// Otomatik oluşturuldu (Vercel build)\n" +
  "window.SUPABASE_URL = " + JSON.stringify(url) + ";\n" +
  "window.SUPABASE_ANON_KEY = " + JSON.stringify(key) + ";\n";

const outPath = path.join(__dirname, "..", "supabase-config.js");
fs.writeFileSync(outPath, content, "utf8");
console.log("supabase-config.js generated");
