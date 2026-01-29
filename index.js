// ================= BASIC =================
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const line = require("@line/bot-sdk");
const fs = require("fs");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_TOKEN;

const client = new line.Client({ channelAccessToken: LINE_TOKEN });

// ================= FILES =================
const GROUP_FILE = "./groups.json";
const CLIENT_FILE = "./clients.json"; // ระบบเช่า + คิดเงิน

const readJSON = (p, d) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : d;
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

// ================= TIME =================
const nowTime = () => new Date().toTimeString().slice(0,5);

// ================= MARKETS (ทั้งหมด) =================
const MARKETS = [
  // ===== ญี่ปุ่น =====
  { name:"🇯🇵 นิเคอิเช้า", session:"morning", open:"09:00", close:"09:10", result:"09:05", url:"https://www.investing.com/indices/japan-ni225", selector:'[data-test="instrument-price-last"]' },
  { name:"🇯🇵 นิเคอิบ่าย", session:"afternoon", open:"14:25", close:"14:35", result:"14:30", url:"https://www.investing.com/indices/japan-ni225", selector:'[data-test="instrument-price-last"]' },

  // ===== จีน =====
  { name:"🇨🇳 จีนเช้า", session:"morning", open:"10:00", close:"10:10", result:"10:05", url:"https://www.investing.com/indices/china-a50", selector:'[data-test="instrument-price-last"]' },
  { name:"🔥 จีน A50 VIP", session:"vip", open:"10:00", close:"10:10", result:"10:05", url:"https://www.investing.com/indices/china-a50", selector:'[data-test="instrument-price-last"]' },

  // ===== ฮ่องกง =====
  { name:"🇭🇰 ฮั่งเส็งเช้า", session:"morning", open:"11:00", close:"11:10", result:"11:05", url:"https://www.investing.com/indices/hang-sen-40", selector:'[data-test="instrument-price-last"]' },
  { name:"🇭🇰 ฮั่งเส็งบ่าย", session:"afternoon", open:"15:00", close:"15:10", result:"15:05", url:"https://www.investing.com/indices/hang-sen-40", selector:'[data-test="instrument-price-last"]' },

  // ===== ยุโรป =====
  { name:"🇩🇪 เยอรมัน DAX", session:"afternoon", open:"15:30", close:"15:40", result:"15:35", url:"https://www.investing.com/indices/germany-30", selector:'[data-test="instrument-price-last"]' },
  { name:"🇬🇧 อังกฤษ FTSE", session:"afternoon", open:"15:00", close:"15:10", result:"15:05", url:"https://www.investing.com/indices/uk-100", selector:'[data-test="instrument-price-last"]' },

  // ===== อเมริกา =====
  { name:"🇺🇸 ดาวโจนส์", session:"vip", open:"20:30", close:"20:40", result:"20:35", url:"https://www.investing.com/indices/us-30", selector:'[data-test="instrument-price-last"]' },
  { name:"🇺🇸 NASDAQ", session:"vip", open:"20:30", close:"20:40", result:"20:35", url:"https://www.investing.com/indices/nasdaq-composite", selector:'[data-test="instrument-price-last"]' }
];

// ================= UTILS =================
const isOpen = (now, m) => now >= m.open && now <= m.close;

const convert = txt => {
  const n = txt.replace(/[^0-9]/g,"");
  return { top:n.slice(-3), bottom:n.slice(-2) };
};

async function fetchPrice(url, selector){
  try{
    const r = await axios.get(url,{headers:{'User-Agent':'Mozilla/5.0'}});
    const $ = cheerio.load(r.data);
    return $(selector).first().text().trim();
  }catch{
    return null;
  }
}

// ================= FLEX =================
const alertFlex = (title,color) => ({
  type:"flex",
  altText:title,
  contents:{
    type:"bubble",
    body:{
      type:"box",
      layout:"vertical",
      backgroundColor:"#000000",
      contents:[{type:"text",text:title,color,weight:"bold",size:"xl"}]
    }
  }
});

const resultFlex = (session, list) => ({
  type:"flex",
  altText:`🔥 ผล${session}`,
  contents:{
    type:"bubble",
    size:"giga",
    body:{
      type:"box",
      layout:"vertical",
      backgroundColor:"#000000",
      contents:[
        {type:"text",text:`🔥 ผลตลาด ${session.toUpperCase()}`,color:"#FF0033",size:"xl",weight:"bold"},
        ...list.map(i=>({
          type:"box",layout:"horizontal",contents:[
            {type:"text",text:i.name,color:"#AAAAAA",flex:3},
            {type:"text",text:`${i.top}-${i.bottom}`,color:"#00FFAA",weight:"bold",align:"end",flex:2}
          ]
        })),
        {type:"text",text:`⏰ ${nowTime()}`,size:"xs",color:"#666666",align:"end"}
      ]
    }
  }
});

// ================= SYSTEM =================
let buffer = {};

setInterval(async()=>{
  const now = nowTime();
  const groups = readJSON(GROUP_FILE,[]);
  const clients = readJSON(CLIENT_FILE,{});

  for(const m of MARKETS){

    // 🔔 แจ้งเปิดตลาด
    if(now === m.open){
      for(const g of groups){
        if(clients[g]?.active)
          await client.pushMessage(g, alertFlex(`🔔 เปิดตลาด ${m.name}`,"#00FFAA"));
      }
    }

    // 🔔 แจ้งปิดตลาด
    if(now === m.close){
      for(const g of groups){
        if(clients[g]?.active)
          await client.pushMessage(g, alertFlex(`⛔ ปิดตลาด ${m.name}`,"#FF0033"));
      }
    }

    // 🎯 ผล
    if(isOpen(now,m) && now===m.result){
      const price = await fetchPrice(m.url,m.selector);
      if(!price) continue;
      const r = convert(price);
      if(!buffer[m.session]) buffer[m.session]=[];
      buffer[m.session].push({name:m.name,...r});
    }
  }

  // 📦 ส่งผลรวม + ตรวจวันหมดอายุ
  for(const s in buffer){
    for(const g of groups){
      const c = clients[g];
      if(!c || !c.active) continue;
      if(!c.pack.includes(s)) continue;
      if(new Date(c.expire) < new Date()){
        c.active=false;
        writeJSON(CLIENT_FILE,clients);
        continue;
      }
      await client.pushMessage(g,resultFlex(s,buffer[s]));
    }
    buffer[s]=[];
  }
},60000);

// ================= WEBHOOK =================
app.post("/webhook",(req,res)=>{
  const groups = readJSON(GROUP_FILE,[]);

  req.body.events?.forEach(async e => {

    // ===== เก็บ groupId อัตโนมัติ =====
    if(e.source?.groupId && !groups.includes(e.source.groupId)){
      groups.push(e.source.groupId);
      writeJSON(GROUP_FILE,groups);
      console.log("➕ บันทึกกลุ่มใหม่", e.source.groupId);
    }

    // ===== คำสั่งแอดมิน /groupid =====
    if(
      e.type === "message" &&
      e.message.type === "text" &&
      e.message.text.trim() === "/groupid" &&
      e.source.type === "group"
    ){
      await client.replyMessage(e.replyToken,{
        type:"text",
        text:`📌 GROUP ID\n${e.source.groupId}`
      });
    }

  });

  res.sendStatus(200);
});

app.listen(PORT,()=>console.log("🔥 FULL STOCK BOT RUNNING"));
);
