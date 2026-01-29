// ================== IMPORT ==================
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const line = require("@line/bot-sdk");

// ================== ENV ==================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_SECRET = process.env.LINE_SECRET;

// ================== LINE ==================
const client = new line.Client({
  channelAccessToken: LINE_TOKEN,
  channelSecret: LINE_SECRET
});

const app = express();
app.use(express.json());

// ================== GROUP ==================
const GROUPS = new Set();

// ================== LOTTO LIST (ภาษาไทย) ==================
const LOTTO = {
  เช้า: ["นิเคอิ", "ฮั่งเส็ง", "จีน", "ไต้หวัน", "เกาหลี"],
  บ่าย: ["นิเคอิบ่าย", "ฮั่งเส็งบ่าย", "จีนบ่าย", "สิงคโปร์"],
  VIP: ["นิเคอิ VIP", "ฮั่งเส็ง VIP", "จีน VIP", "ดาวโจนส์ VIP"]
};

// ================== MAP ชื่อ ↔ คำค้น ==================
const RESULT_KEYWORD = {
  "นิเคอิ": "NIKKEI",
  "ฮั่งเส็ง": "HANG SENG",
  "จีน": "CHINA",
  "ไต้หวัน": "TAIWAN",
  "เกาหลี": "KOREA",

  "นิเคอิบ่าย": "NIKKEI",
  "ฮั่งเส็งบ่าย": "HANG SENG",
  "จีนบ่าย": "CHINA",
  "สิงคโปร์": "SINGAPORE",

  "นิเคอิ VIP": "NIKKEI",
  "ฮั่งเส็ง VIP": "HANG SENG",
  "จีน VIP": "CHINA",
  "ดาวโจนส์ VIP": "DOW JONES"
};

// ================== SOURCE ==================
const SOURCE_URL = "https://thederbyapex.com/huay-live/";

// ================== SCRAPE RESULT (ของจริง) ==================
async function fetchResultReal(lottoName) {
  try {
    const keyword = RESULT_KEYWORD[lottoName];
    if (!keyword) return "-";

    const res = await axios.get(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    let result = "-";

    $("table tr").each((_, el) => {
      const row = $(el).text().replace(/\s+/g, " ").trim();
      if (row.toUpperCase().includes(keyword)) {
        const m = row.match(/\d{2,}/);
        if (m) result = m[0];
      }
    });

    return result;
  } catch (e) {
    console.log("ดึงผลไม่สำเร็จ:", lottoName);
    return "-";
  }
}

// ================== FLEX (ดำ–ทอง) ==================
async function flexResultReal(title, list) {
  const rows = [];

  for (const l of list) {
    const r = await fetchResultReal(l);
    rows.push({
      type: "text",
      text: `• ${l} : ${r}`,
      color: "#FFFFFF",
      size: "md",
      margin: "sm"
    });
  }

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
          {
            type: "separator",
            margin: "md",
            color: "#FFD700"
          },
          ...rows,
          {
            type: "text",
            text: "AUTO RESULT",
            size: "xs",
            color: "#777777",
            align: "center",
            margin: "md"
          }
        ]
      }
    }
  };
}

// ================== SEND RESULT ==================
async function sendResult(type) {
  const flex = await flexResultReal(`📊 ผลหุ้น ${type}`, LOTTO[type]);
  for (const gid of GROUPS) {
    await client.pushMessage(gid, flex);
  }
}

// ================== AUTO TIME ==================
setInterval(() => {
  const now = new Date().toTimeString().slice(0,5);

  if (now === "09:35") sendResult("เช้า");
  if (now === "14:35") sendResult("บ่าย");
  if (now === "22:05") sendResult("VIP");

}, 60000);

// ================== MENU FLEX ==================
function menuFlex() {
  return {
    type: "flex",
    altText: "เมนูเลือกตลาด",
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: "#000000" } },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "เลือกตลาด",
            weight: "bold",
            size: "lg",
            color: "#FFD700"
          },
          {
            type: "button",
            action: { type: "message", label: "📊 หุ้นเช้า", text: "เช้า" },
            style: "primary",
            color: "#FFD700",
            margin: "md"
          },
          {
            type: "button",
            action: { type: "message", label: "📊 หุ้นบ่าย", text: "บ่าย" },
            style: "primary",
            color: "#FFD700",
            margin: "sm"
          },
          {
            type: "button",
            action: { type: "message", label: "👑 VIP", text: "VIP" },
            style: "primary",
            color: "#FFD700",
            margin: "sm"
          }
        ]
      }
    }
  };
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  for (const e of req.body.events) {

    if (e.source?.groupId) GROUPS.add(e.source.groupId);

    if (e.message?.text === "/menu") {
      await client.replyMessage(e.replyToken, menuFlex());
    }

    if (["เช้า", "บ่าย", "VIP"].includes(e.message?.text)) {
      const flex = await flexResultReal(
        `📊 ผลหุ้น ${e.message.text}`,
        LOTTO[e.message.text]
      );
      await client.replyMessage(e.replyToken, flex);
    }

    if (e.message?.text === "/groupid") {
      await client.replyMessage(e.replyToken, {
        type: "text",
        text: `GROUP ID:\n${e.source.groupId}`
      });
    }
  }
  res.sendStatus(200);
});

// ================== START ==================
app.get("/", (_, res) => res.send("🔥 BOT RUNNING"));
app.listen(PORT, () => console.log("🔥 FULL BOT READY"));
