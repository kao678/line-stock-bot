require("dotenv").config();
const express = require("express");
const { google } = require("googleapis");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= GOOGLE SHEET =================
const SHEET_ID = process.env.GSHEET_ID;

const auth = new google.auth.GoogleAuth({
  keyFile: "./service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

// ================= READ SHEET =================
async function readSheet() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A2:C",
  });

  return res.data.values || [];
}

// ================= REPORT =================
async function reportLotto() {
  try {
    const rows = await readSheet();

    if (!rows.length) {
      console.log("❌ ไม่มีข้อมูลในชีต");
      return;
    }

    rows.forEach(row => {
      const [name, result, time] = row;
      console.log(`🎯 ${name} | ${result} | ${time}`);
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

// ================= CRON (ออโต้) =================
// ทุกวัน 16:30
cron.schedule("30 16 * * *", () => {
  console.log("⏰ AUTO REPORT");
  reportLotto();
});

// ================= SERVER =================
app.get("/", (req, res) => {
  res.send("LOTTO BOT RUNNING ✅");
});

app.listen(PORT, () => {
  console.log("🚀 Server started on", PORT);
});
