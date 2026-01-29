// ================= BASIC =================
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// ================= LINE =================
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

app.use(express.json());

// ================= FILE =================
const GROUP_FILE = "./groups.json";
const CLIENT_FILE = "./clients.json";

const readJSON = (f, d = []) => {
  if (!fs.existsSync(f)) return d;
  return JSON.parse(fs.readFileSync(f));
};
const writeJSON = (f, d) =>
  fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ================= MARKET CONFIG =================
const MARKETS = {
  morning: { label: "เช้า", color: "#ff5555" },
  afternoon: { label: "บ่าย", color: "#ffaa00" },
  vip: { label: "VIP", color: "#7b61ff" }
};

// ================= FLEX RESULT =================
const resultFlex = (market, results) => ({
  type: "flex",
  altText: `📊 ผลหวยหุ้น ${MARKETS[market].label}`,
  contents: {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `ผลหวยหุ้น ${MARKETS[market].label}`,
          size: "xl",
          weight: "bold",
          color: "#ffffff"
        }
      ],
      backgroundColor: MARKETS[market].color,
      paddingAll: "16px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: results.map(r => ({
        type: "text",
        text: `• ${r.name} : ${r.up} - ${r.down}`,
        size: "md"
      }))
    }
  }
});

// ================= AUTO FETCH RESULT =================
// ❗ เปลี่ยน URL เว็บตรงนี้ภายหลังได้
async function fetchResult(market) {
  // ตัวอย่าง MOCK (แทนด้วยเว็บจริง)
  return [
    { name: "NIKKEI", up: "508", down: "06" },
    { name: "HANGSENG", up: "746", down: "57" }
  ];
}

// ================= AUTO SEND =================
setInterval(async () => {
  const groups = readJSON(GROUP_FILE, []);
  const clients = readJSON(CLIENT_FILE, {});

  for (const market of Object.keys(MARKETS)) {
    const results = await fetchResult(market);

    for (const gid of groups) {
      const c = clients[gid];
      if (!c) continue;
      if (new Date(c.expire) < new Date()) continue;
      if (!c.pack.includes(market)) continue;

      await client.pushMessage(gid, resultFlex(market, results));
    }
  }
}, 60000); // ทุก 1 นาที (ปรับได้)

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  const groups = readJSON(GROUP_FILE, []);
  const clients = readJSON(CLIENT_FILE, {});

  for (const e of req.body.events || []) {
    // เก็บ groupId
    if (e.source?.type === "group") {
      if (!groups.includes(e.source.groupId)) {
        groups.push(e.source.groupId);
        writeJSON(GROUP_FILE, groups);

        // สมัคร trial อัตโนมัติ
        clients[e.source.groupId] = {
          pack: ["morning"],
          expire: new Date(Date.now() + 3 * 86400000) // 3 วัน
        };
        writeJSON(CLIENT_FILE, clients);
      }
    }

    // /groupid
    if (
      e.type === "message" &&
      e.message.type === "text" &&
      e.message.text === "/groupid"
    ) {
      await client.replyMessage(e.replyToken, {
        type: "text",
        text: `📌 GROUP ID\n${e.source.groupId}`
      });
    }
  }

  res.sendStatus(200);
});

// ================= START =================
app.listen(PORT, () => {
  console.log("🔥 FULL STOCK BOT RUNNING");
});
