// ===============================
// FULL STOCK LOTTO LINE BOT
// Single file | No puppeteer
// ===============================

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

// ================= CONFIG =================
const PORT = process.env.PORT || 10000;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_SECRET = process.env.LINE_SECRET;

if (!LINE_TOKEN || !LINE_SECRET) {
  throw new Error("❌ LINE TOKEN / SECRET หาย");
}

const client = new line.Client({
  channelAccessToken: LINE_TOKEN,
  channelSecret: LINE_SECRET,
});

const app = express();
app.use(express.json());

// ================= FILE DB =================
const GROUP_FILE = "./groups.json";
const CLIENT_FILE = "./clients.json";

const readJSON = (f, d) => {
  try { return JSON.parse(fs.readFileSync(f)); }
  catch { return d; }
};
const writeJSON = (f, d) =>
  fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ================= MARKET CONFIG =================
const MARKETS = {
  morning: [
    { name: "นิเคอิ", code: "nikkei" },
    { name: "ฮั่งเส็ง", code: "hangseng" }
  ],
  afternoon: [
    { name: "จีน", code: "china" },
    { name: "ฮั่งเส็งบ่าย", code: "hangseng" }
  ],
  vip: [
    { name: "ดาวโจนส์ VIP", code: "dowjones" },
    { name: "เยอรมัน VIP", code: "germany" }
  ]
};

// 🔥 เว็บดึงผล (คุณเปลี่ยน / เพิ่มได้ตรงนี้)
const SOURCE_URL = "https://thederbyapex.com/huay-live/";

// ================= FETCH RESULT =================
async function fetchResult(code) {
  try {
    const { data } = await axios.get(SOURCE_URL, {
      timeout: 15000,
      headers: { "user-agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(data);
    let value = "รอผล";

    $("table tr").each((_, el) => {
      const t = $(el).text();
      if (t.toLowerCase().includes(code)) {
        value = t.replace(/\s+/g, " ").trim();
      }
    });

    return value;
  } catch (e) {
    return "ดึงไม่ได้";
  }
}

// ================= FLEX =================
function resultFlex(title, rows) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      styles: {
        body: { backgroundColor: "#000000" }
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "lg",
            color: "#FFD700"
          },
          { type: "separator", margin: "md" },
          ...rows.map(r => ({
            type: "text",
            text: `• ${r}`,
            color: "#FFFFFF",
            size: "sm",
            margin: "sm"
          })),
          {
            type: "text",
            text: "⏰ อัปเดตอัตโนมัติ | ระบบ VIP",
            size: "xs",
            color: "#AAAAAA",
            margin: "lg"
          }
        ]
      }
    }
  };
}

// ================= SEND RESULT =================
async function sendResult(session) {
  const groups = readJSON(GROUP_FILE, []);
  const clients = readJSON(CLIENT_FILE, {});

  const markets = MARKETS[session];
  if (!markets) return;

  const rows = [];
  for (const m of markets) {
    const r = await fetchResult(m.code);
    rows.push(`${m.name} : ${r}`);
  }

  const flex = resultFlex(`📊 ผลหวยหุ้น ${session === "morning" ? "เช้า" : session === "afternoon" ? "บ่าย" : "VIP"}`, rows);

  for (const gid of groups) {
    const c = clients[gid];
    if (!c || !c.active) continue;
    if (new Date(c.expire) < new Date()) {
      c.active = false;
      writeJSON(CLIENT_FILE, clients);
      continue;
    }
    await client.pushMessage(gid, flex);
  }
}

// ================= AUTO TIME =================
setInterval(() => {
  const h = new Date().getHours();

  if (h === 10) sendResult("morning");
  if (h === 14) sendResult("afternoon");
  if (h === 21) sendResult("vip");

}, 60000);

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  const groups = readJSON(GROUP_FILE, []);
  const clients = readJSON(CLIENT_FILE, {});

  for (const e of req.body.events) {
    // เก็บ groupId
    if (e.source?.groupId && !groups.includes(e.source.groupId)) {
      groups.push(e.source.groupId);
      writeJSON(GROUP_FILE, groups);

      clients[e.source.groupId] = {
        active: true,
        expire: "2099-12-31"
      };
      writeJSON(CLIENT_FILE, clients);
    }

    // /groupid
    if (e.type === "message" && e.message.type === "text") {
      const text = e.message.text.trim();

      if (text === "/groupid") {
        await client.replyMessage(e.replyToken, {
          type: "text",
          text: `📌 GROUP ID\n${e.source.groupId}`
        });
      }

      if (text === "/test") {
        await client.replyMessage(e.replyToken,
          resultFlex("🔥 TEST BOT", ["ระบบพร้อมใช้งาน"])
        );
      }
    }
  }

  res.sendStatus(200);
});

// ================= START =================
app.listen(PORT, () =>
  console.log("🔥 FULL STOCK BOT RUNNING")
);
