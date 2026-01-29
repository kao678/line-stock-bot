// ================== CONFIG ==================
import express from "express";
import line from "@line/bot-sdk";

const PORT = process.env.PORT || 10000;
const LINE_TOKEN = process.env.LINE_TOKEN;      // Channel access token
const LINE_SECRET = process.env.LINE_SECRET;    // Channel secret
const GROUP_ID = process.env.GROUP_ID;          // groupId ที่จะส่งแจ้งเตือน

if (!LINE_TOKEN || !LINE_SECRET || !GROUP_ID) {
  console.error("❌ Missing ENV (LINE_TOKEN / LINE_SECRET / GROUP_ID)");
  process.exit(1);
}

const client = new line.Client({
  channelAccessToken: LINE_TOKEN,
  channelSecret: LINE_SECRET,
});

const app = express();
app.use(express.json());

// ================== กันเด้ง ==================
const lastResults = {}; // { marketKey: "เลขล่าสุด" }

// ================== ตลาด (เพิ่มได้ที่นี่) ==================
const MARKETS = [
  {
    key: "nikkei_morning",
    title: "ผลหวยหุ้น เช้า",
    name: "นิเคอิเช้า",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".nikkei .result", // ⚠️ ตัวอย่าง selector
  },
  {
    key: "hangseng_morning",
    title: "ผลหวยหุ้น เช้า",
    name: "ฮั่งเส็งเช้า",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".hangseng .result",
  },
  {
    key: "dowjones_vip",
    title: "ผลหวยหุ้น VIP",
    name: "ดาวโจนส์ VIP",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".dowjones .result",
  },
  {
    key: "germany_vip",
    title: "ผลหวยหุ้น VIP",
    name: "เยอรมัน VIP",
    url: "https://thederbyapex.com/huay-live/",
    selector: ".germany .result",
  },
];

// ================== ดึงผลจริง ==================
async function fetchResult(market) {
  const res = await fetch(market.url, { cache: "no-store" });
  const html = await res.text();

  // ดึงด้วย selector แบบง่าย (regex fallback)
  // แนะนำ: ปรับ selector ให้ตรงเว็บจริง
  const regex = new RegExp(
    market.selector.replace(".", "\\.") + "[^>]*>(.*?)<",
    "i"
  );
  const match = html.match(regex);

  if (!match) return "รอผล";

  const text = match[1].replace(/\s+/g, " ").trim();
  return text || "รอผล";
}

// ================== Flex สีดำ–ทอง ==================
function resultFlex(title, items) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#000000",
        contents: [
          {
            type: "text",
            text: `📊 ${title}`,
            color: "#FFD700",
            weight: "bold",
            size: "lg",
          },
          { type: "separator", margin: "md", color: "#FFD700" },
          ...items.map((t) => ({
            type: "text",
            text: `• ${t}`,
            color: "#FFFFFF",
            margin: "md",
            size: "md",
          })),
          {
            type: "text",
            text: "⏰ อัปเดตอัตโนมัติ",
            color: "#AAAAAA",
            size: "sm",
            margin: "lg",
          },
        ],
      },
    },
  };
}

// ================== ตรวจ + ส่ง (กันเด้ง) ==================
async function checkAndNotify() {
  const groupsByTitle = {};

  for (const m of MARKETS) {
    try {
      const result = await fetchResult(m);

      // ❌ ข้ามรอผล
      if (!result || result.includes("รอผล")) continue;

      // ❌ กันเด้ง: ถ้าเหมือนเดิม ไม่ส่ง
      if (lastResults[m.key] === result) continue;

      // ✅ บันทึกผลใหม่
      lastResults[m.key] = result;

      if (!groupsByTitle[m.title]) groupsByTitle[m.title] = [];
      groupsByTitle[m.title].push(`${m.name} : ${result}`);
    } catch (e) {
      console.error("❌ Error", m.name, e.message);
    }
  }

  // ส่ง Flex แยกตามหัวข้อ (เช้า / VIP)
  for (const title of Object.keys(groupsByTitle)) {
    const flex = resultFlex(title, groupsByTitle[title]);
    await client.pushMessage(GROUP_ID, flex);
  }
}

// ================== ตั้งเวลาออโต้ ==================
// เช็คทุก 1 นาที (ปลอดภัย + ไม่เด้ง)
setInterval(checkAndNotify, 60 * 1000);

// ================== Webhook (ใช้ /groupid ได้) ==================
app.post("/webhook", async (req, res) => {
  for (const e of req.body.events || []) {
    if (
      e.type === "message" &&
      e.message.type === "text" &&
      e.message.text.trim() === "/groupid" &&
      e.source.type === "group"
    ) {
      await client.replyMessage(e.replyToken, {
        type: "text",
        text: `📌 GROUP ID\n${e.source.groupId}`,
      });
    }
  }
  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("BOT ONLINE"));
app.listen(PORT, () => console.log("🔥 BOT RUNNING"));
