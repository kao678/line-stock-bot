// ================== CONFIG ==================
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const line = require("@line/bot-sdk");

// ===== LINE ENV =====
const PORT = process.env.PORT || 3000;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_TOKEN;
const CHANNEL_SECRET = process.env.LINE_SECRET;

const client = new line.Client({
  channelAccessToken: CHANNEL_ACCESS_TOKEN
});

const app = express();
app.use(express.json());

// ================== MARKET LIST ==================
const MARKETS = [
  {
    key: "nikkei_morning_vip",
    name: "นิเคอิเช้า VIP",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".table tbody tr"
  },
  {
    key: "china_morning_vip",
    name: "จีนเช้า VIP",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".table tbody tr"
  },
  {
    key: "dowjones_vip",
    name: "ดาวโจนส์ VIP",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".table tbody tr"
  }
];

// ================== GROUP STORAGE (ง่าย ๆ) ==================
const GROUPS = new Set();

// ================== FLEX ==================
function resultFlex(title, result) {
  return {
    type: "flex",
    altText: `แจ้งผล ${title}`,
    contents: {
      type: "bubble",
      hero: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📊 แจ้งผลหวย",
            weight: "bold",
            size: "lg",
            color: "#ffffff"
          }
        ],
        backgroundColor: "#b71c1c",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "md"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: result || "รอผลประกาศ",
            size: "xl",
            weight: "bold",
            color: "#d50000",
            margin: "lg"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "BOT AUTO • REAL DATA",
            size: "xs",
            align: "center",
            color: "#888888"
          }
        ]
      }
    }
  };
}

// ================== SCRAPER ==================
async function fetchResult(market) {
  try {
    const res = await axios.get(market.url, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(res.data);

    let result = "";

    $(market.selector).each((i, el) => {
      const row = $(el).text().replace(/\s+/g, " ").trim();
      if (row.includes("นิเคอิ") || row.includes("ดาวโจนส์") || row.includes("จีน")) {
        result = row;
      }
    });

    return result || "ไม่พบข้อมูล";
  } catch (err) {
    console.error("❌ ERROR FETCH:", market.name);
    return "ดึงข้อมูลไม่ได้";
  }
}

// ================== AUTO PUSH ==================
async function pushAll() {
  for (const market of MARKETS) {
    const result = await fetchResult(market);
    for (const gid of GROUPS) {
      await client.pushMessage(gid, resultFlex(market.name, result));
    }
  }
}

// ดึงผลทุก 5 นาที (ปรับได้)
setInterval(pushAll, 5 * 60 * 1000);

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  for (const event of req.body.events) {
    // เก็บ group id อัตโนมัติ
    if (event.source?.groupId) {
      GROUPS.add(event.source.groupId);
    }

    // คำสั่ง /groupid
    if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.message.text.trim() === "/groupid"
    ) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `📌 GROUP ID\n${event.source.groupId}`
      });
    }

    // คำสั่ง /test
    if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.message.text.trim() === "/test"
    ) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "🔥 BOT ONLINE พร้อมใช้งาน"
      });
    }
  }
  res.sendStatus(200);
});

// ================== START ==================
app.get("/", (req, res) => {
  res.send("🔥 LINE STOCK BOT RUNNING");
});

app.listen(PORT, () => {
  console.log("🔥 FULL STOCK BOT RUNNING");
});
