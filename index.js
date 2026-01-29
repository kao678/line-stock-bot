// ================== IMPORT ==================
const express = require("express");
const line = require("@line/bot-sdk");
const puppeteer = require("puppeteer");

// ================== APP ==================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ================== LINE ==================
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// ================== GROUP STORAGE ==================
let GROUPS = [];

// ================== MARKET LIST (ครบตามที่ให้มา) ==================
const MARKETS = [
  // ===== VIP =====
  { name:"นิเคอิเช้า VIP", open:"09:00", close:"09:05" },
  { name:"จีนเช้า VIP", open:"10:00", close:"10:05" },
  { name:"ฮั่งเส็งเช้า VIP", open:"10:25", close:"10:35" },
  { name:"ไต้หวัน VIP", open:"11:25", close:"11:35" },
  { name:"เกาหลี VIP", open:"12:25", close:"12:35" },
  { name:"นิเคอิบ่าย VIP", open:"13:35", close:"13:45" },
  { name:"จีนบ่าย VIP", open:"12:45", close:"12:55" },
  { name:"ฮั่งเส็งบ่าย VIP", open:"14:45", close:"14:55" },
  { name:"สิงคโปร์ VIP", open:"14:45", close:"16:25" },
  { name:"ลาว VIP", open:"20:20", close:"20:30" },
  { name:"ลาวสตาร์ VIP", open:"20:45", close:"20:55" },
  { name:"อังกฤษ VIP", open:"21:40", close:"21:50" },
  { name:"เยอรมัน VIP", open:"22:00", close:"22:40" },
  { name:"รัสเซีย VIP", open:"22:00", close:"22:50" },
  { name:"ดาวโจนส์ VIP", open:"00:00", close:"03:10" },
  { name:"ฮานอย VIP", open:"18:05", close:"18:30" },
  { name:"ฮานอย EXTRA", open:"19:05", close:"19:30" },

  // ===== ปกติ / รายวัน =====
  { name:"ลาว TV", open:"10:20", close:"10:30" },
  { name:"ฮานอย HD", open:"11:05", close:"11:30" },
  { name:"ฮานอยสตาร์", open:"12:05", close:"12:35" },
  { name:"ลาว HD", open:"13:45", close:"13:55" },
  { name:"สิงคโปร์", open:"14:45", close:"16:25" },
  { name:"ฮานอย TV", open:"16:05", close:"16:30" },
  { name:"ลาวสตาร์", open:"18:20", close:"18:30" },
  { name:"ฮานอยกาชาด", open:"17:05", close:"17:30" },
  { name:"ฮานอยสามัคคี", open:"18:05", close:"18:30" },
  { name:"ฮานอยพัฒนา", open:"19:05", close:"19:30" },
  { name:"ลาวสามัคคี", open:"19:20", close:"19:30" },
  { name:"ลาวอาเซียน", open:"20:20", close:"20:30" },
  { name:"ลาวกาชาด", open:"21:20", close:"21:30" },

  // ===== หุ้นปกติ =====
  { name:"นิเคอิเช้า", open:"09:15", close:"09:30" },
  { name:"จีนเช้า", open:"10:15", close:"10:30" },
  { name:"ฮั่งเส็งเช้า", open:"10:45", close:"11:05" },
  { name:"ไต้หวัน", open:"12:05", close:"12:35" },
  { name:"เกาหลี", open:"12:35", close:"13:40" },
  { name:"นิเคอิบ่าย", open:"13:35", close:"14:05" },
  { name:"จีนบ่าย", open:"12:45", close:"13:00" },
  { name:"ฮั่งเส็งบ่าย", open:"14:45", close:"15:10" },
  { name:"ไทยเย็น", open:"16:15", close:"16:40" },
  { name:"อินเดีย", open:"18:20", close:"18:30" },
  { name:"อียิปต์", open:"18:20", close:"18:30" },
  { name:"รัสเซีย", open:"22:00", close:"22:50" },
  { name:"อังกฤษ", open:"21:40", close:"21:50" },
  { name:"เยอรมัน", open:"22:00", close:"22:40" },
  { name:"ดาวโจนส์", open:"00:00", close:"03:10" },

  // ===== ต่างประเทศ =====
  { name:"ฮานอยพิเศษ", open:"18:05", close:"18:30" },
  { name:"ฮานอยปกติ", open:"18:05", close:"18:30" },
  { name:"ลาวพัฒนา", open:"20:20", close:"20:30" }
];

// ================== TIME ==================
function nowHM(){
  return new Date().toTimeString().slice(0,5);
}

// ================== FLEX ==================
function flexMsg(title, body){
  return {
    type:"flex",
    altText:title,
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        backgroundColor:"#000000",
        paddingAll:"lg",
        contents:[
          { type:"text", text:title, weight:"bold", size:"xl", color:"#FF0033" },
          { type:"text", text:body, wrap:true, color:"#FFFFFF", margin:"md" }
        ]
      }
    }
  };
}

// ================== SCRAPE RESULT ==================
const TARGET_URL = "https://thederbyapex.com/huay-live/";

async function scrapeResult(){
  const browser = await puppeteer.launch({
    headless:"new",
    args:["--no-sandbox","--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto(TARGET_URL,{waitUntil:"networkidle2"});
  await page.waitForTimeout(3000);

  const text = await page.evaluate(()=>{
    return document.body.innerText.slice(0,1500);
  });

  await browser.close();
  return text;
}

// ================== AUTO SCHEDULER ==================
let sentFlag = {};

setInterval(async ()=>{
  const time = nowHM();

  for(const m of MARKETS){
    if(!sentFlag[m.name]) sentFlag[m.name] = { open:false, close:false, near:false };

    // เปิดตลาด
    if(time === m.open && !sentFlag[m.name].open){
      for(const g of GROUPS){
        await client.pushMessage(g, flexMsg("🔓 เปิดตลาด", m.name));
      }
      sentFlag[m.name].open = true;
    }

    // ใกล้ปิด (5 นาที)
    const [ch,cm] = m.close.split(":").map(Number);
    const near = new Date();
    near.setHours(ch);
    near.setMinutes(cm-5);
    const nearHM = near.toTimeString().slice(0,5);

    if(time === nearHM && !sentFlag[m.name].near){
      for(const g of GROUPS){
        await client.pushMessage(g, flexMsg("⏰ ใกล้ปิดตลาด", m.name));
      }
      sentFlag[m.name].near = true;
    }

    // ปิดตลาด + ผล
    if(time === m.close && !sentFlag[m.name].close){
      const result = await scrapeResult();
      for(const g of GROUPS){
        await client.pushMessage(
          g,
          flexMsg(`📊 ผล ${m.name}`, result)
        );
      }
      sentFlag[m.name].close = true;
    }
  }

  // reset ทุกเที่ยงคืน
  if(time === "00:00") sentFlag = {};

},60000);

// ================== WEBHOOK ==================
app.post("/webhook", async (req,res)=>{
  for(const e of req.body.events){
    if(e.source?.groupId && !GROUPS.includes(e.source.groupId)){
      GROUPS.push(e.source.groupId);
    }

    if(
      e.type==="message" &&
      e.message.type==="text" &&
      e.message.text==="/groupid"
    ){
      await client.replyMessage(e.replyToken,{
        type:"text",
        text:`📌 GROUP ID\n${e.source.groupId}`
      });
    }
  }
  res.sendStatus(200);
});

// ================== START ==================
app.listen(PORT,()=>{
  console.log("🔥 FULL HUAY BOT RUNNING");
});
