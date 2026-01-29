const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_TOKEN;

if (!LINE_TOKEN) {
  console.error("❌ ไม่พบ LINE_TOKEN");
  process.exit(1);
}

const client = new line.Client({
  channelAccessToken: LINE_TOKEN
});

// ================= UTIL =================
const readJSON = (path, def = []) =>
  fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : def;

const writeJSON = (path, data) =>
  fs.writeFileSync(path, JSON.stringify(data, null, 2));

// ================= MARKETS =================
// 🔧 แก้เวลาได้ตามต้องการ (เวลาไทย)
const MARKETS = [
  {
    name: "🇯🇵 นิเคอิเช้า vip",
    time: "09:05",
    url: "https://www.investing.com/indices/japan-ni225",
    selector: '[data-test="instrument-price-last"]'
  },
  {
    name: "🇯🇵 นิเคอิ vip",
    time: "09:30",
    url: "https://www.investing.com/indices/japan-ni225",
    selector: '[data-test="instrument-price-last"]'
  },
  {
    name: "🇨🇳 จีนเช้า vip",
    time: "10:05",
    url: "https://www.investing.com/indices/china-a50",
    selector: '[data-test="instrument-price-last"]'
  }
];

// ================= FLEX (สไตล์เหมือนภาพ) =================
function resultFlex(market, time, top, bottom) {
  return {
    type: "flex",
    altText: `[bot] ${market} ${top}-${bottom}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        paddingAll: "lg",
        contents: [
          {
            type: "text",
            text: "[bot] ประกาศผล",
            size: "md",
            weight: "bold",
            color: "#000000"
          },
          {
            type: "text",
            text: market,
            size: "md",
            color: "#000000",
            margin: "sm"
          },
          {
            type: "text",
            text: `เวลา ${time} น.`,
            size: "sm",
            color: "#666666",
            margin: "sm"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: `${top} - ${bottom}`,
            size: "xxl",
            weight: "bold",
            color: "#000000",
            align: "center",
            margin: "lg"
          }
        ]
      }
    }
  };
}

// ================= FETCH PRICE =================
async function fetchPrice(url, selector) {
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000
    });
    const $ = cheerio.load(res.data);
    const priceText = $(selector).first().text().replace(/,/g, "");
    return parseFloat(priceText);
  } catch (err) {
    console.log("❌ ดึงราคาหุ้นไม่สำเร็จ");
    return null;
  }
}

// ================= CONVERT TO LOTTERY =================
function convert(price) {
  const parts = price.toString().split(".");
  const top = parts[0].slice(-3);
  const bottom = (parts[1] || "00").slice(0, 2);
  return { top, bottom };
}

// ================= AUTO SEND (แจ้งทีละหวย) =================
setInterval(async () => {
  const now = new Date().toTimeString().slice(0, 5);

  for (const m of MARKETS) {
    if (now === m.time) {
      const price = await fetchPrice(m.url, m.selector);
      if (!price) return;

      const { top, bottom } = convert(price);
      const groups = readJSON("./data/groups.json", []);

      for (const gid of groups) {
        await client.pushMessage(
          gid,
          resultFlex(m.name, now, top, bottom)
        );
      }

      console.log(`✅ แจ้งผลแล้ว ${m.name} ${top}-${bottom}`);
    }
  }
}, 60000);

// ================= WEBHOOK =================
app.post("/webhook", (req, res) => {
  req.body.events.forEach(ev => {
    // บันทึก groupId อัตโนมัติเมื่อบอทถูกเชิญเข้ากลุ่ม
    if (ev.type === "join" && ev.source.type === "group") {
      const groups = readJSON("./data/groups.json", []);
      if (!groups.includes(ev.source.groupId)) {
        groups.push(ev.source.groupId);
        writeJSON("./data/groups.json", groups);
        console.log("➕ บันทึกกลุ่มใหม่แล้ว");
      }
    }
  });
  res.sendStatus(200);
});

// ================= START =================
app.listen(PORT, () => {
  console.log("🔥 บอทแจ้งเตือนออโต้ พร้อมใช้งาน");
});
