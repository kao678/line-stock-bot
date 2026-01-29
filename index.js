// ================= SETUP =================
const express = require("express");
const line = require("@line/bot-sdk");
const fetch = require("node-fetch");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 10000;

// ================= LINE CONFIG =================
const config = {
  channelAccessToken: process.env.LINE_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

if (!config.channelAccessToken || !config.channelSecret) {
  throw new Error("❌ no channel access token");
}

const client = new line.Client(config);
app.use(express.json());

// ================= MARKET CONFIG =================
const MARKETS = {
  morning: [
    { name: "นิเคอิเช้า", key: "NIKKEI" },
    { name: "ฮั่งเส็งเช้า", key: "HANGSENG" },
  ],
  afternoon: [
    { name: "นิเคอิบ่าย", key: "NIKKEI_PM" },
    { name: "ฮั่งเส็งบ่าย", key: "HANGSENG_PM" },
  ],
  vip: [
    { name: "ดาวโจนส์ VIP", key: "DOWJONES" },
    { name: "เยอรมัน VIP", key: "GERMANY" },
  ],
};

// 🔗 เว็บดึงผลจริง (คุณเปลี่ยนได้)
const RESULT_API = "https://thederbyapex.com/huay-live/";

// ================= FLEX BUILDER =================
function buildFlex(title, items) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#000000" },
        body: { backgroundColor: "#111111" },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            color: "#FFD700",
            weight: "bold",
            size: "lg",
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: items.map((i) => ({
          type: "text",
          text: `• ${i.name} : ${i.result}`,
          color: "#FFFFFF",
          size: "md",
        })),
      },
    },
  };
}

// ================= FETCH RESULT (MOCK / REAL) =================
async function fetchResult(key) {
  // 🔥 ตัวอย่าง (คุณผูก selector จริงภายหลังได้)
  // ตอนนี้ทำให้ระบบไม่พังและใช้งานได้
  return `${Math.floor(Math.random() * 900)}-${Math.floor(
    Math.random() * 90
  )}`;
}

// ================= SEND RESULT =================
async function sendResult(groupId, period) {
  const markets = MARKETS[period];
  if (!markets) return;

  const results = [];
  for (const m of markets) {
    const r = await fetchResult(m.key);
    results.push({ name: m.name, result: r });
  }

  const title =
    period === "morning"
      ? "📊 ผลหวยหุ้น เช้า"
      : period === "afternoon"
      ? "📊 ผลหวยหุ้น บ่าย"
      : "👑 ผลหวยหุ้น VIP";

  await client.pushMessage(groupId, buildFlex(title, results));
}

// ================= WEBHOOK =================
app.post("/webhook", (req, res) => {
  res.sendStatus(200); // ตอบ LINE ก่อน (กัน 499)

  (async () => {
    for (const event of req.body.events) {
      if (event.type !== "message") continue;
      const text = event.message.text;
      const replyToken = event.replyToken;

      // ===== GROUP ID =====
      if (text === "/groupid" && event.source.groupId) {
        await client.replyMessage(replyToken, {
          type: "text",
          text: `📌 GROUP ID\n${event.source.groupId}`,
        });
      }

      // ===== TEST =====
      if (text === "/test") {
        await client.replyMessage(replyToken, {
          type: "text",
          text: "🔥 BOT READY",
        });
      }

      // ===== MENU =====
      if (text === "เช้า") {
        await sendResult(event.source.groupId, "morning");
      }
      if (text === "บ่าย") {
        await sendResult(event.source.groupId, "afternoon");
      }
      if (text === "VIP") {
        await sendResult(event.source.groupId, "vip");
      }
    }
  })();
});

// ================= AUTO SCHEDULE =================
// เช้า 10:05
cron.schedule("5 10 * * 1-5", () => {
  sendResult(process.env.GROUP_ID, "morning");
});

// บ่าย 14:05
cron.schedule("5 14 * * 1-5", () => {
  sendResult(process.env.GROUP_ID, "afternoon");
});

// VIP 21:40
cron.schedule("40 21 * * 1-5", () => {
  sendResult(process.env.GROUP_ID, "vip");
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => res.send("BOT OK"));

// ================= START =================
app.listen(PORT, () => {
  console.log("🔥 FULL STOCK BOT RUNNING");
});
