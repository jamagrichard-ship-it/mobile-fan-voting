import express from "express";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { Server } from "socket.io";
import http from "http";

const app=express(); app.use(express.json()); app.use(express.static("public"));
const server=http.createServer(app); const io=new Server(server);
let people=[]; let config={username:"",giftName:"Rose",voteValue:1,commentWindowSec:60};
let connection=null, connected=false, eventLog=[];
const selections=new Map();
function log(message){eventLog.unshift({time:new Date().toLocaleTimeString(),message});eventLog=eventLog.slice(0,80);io.emit("log",eventLog);}
function emitState(){io.emit("state",{people:people.slice().sort((a,b)=>b.votes-a.votes),config,connected,eventLog});}
app.get("/api/state",(req,res)=>res.json({people,config,connected,eventLog}));
app.post("/api/config",async(req,res)=>{
 const {username,giftName,voteValue,commentWindowSec}=req.body;
 config.username=String(username||"").replace(/^@/,"").trim();
 config.giftName=String(giftName||"Rose").trim();
 config.voteValue=Math.max(1,Number(voteValue)||1);
 config.commentWindowSec=Math.max(10,Number(commentWindowSec)||60);
 res.json({ok:true});emitState();
});
app.post("/api/housemates",(req,res)=>{let name=String(req.body.name||"").trim().toUpperCase();if(!name)return res.status(400).json({error:"Name required"});if(people.some(p=>p.name===name))return res.status(409).json({error:"Already exists"});people.push({name,label:String(req.body.label||"HOUSEMATE"),votes:0});log("Added "+name);emitState();res.json({ok:true});});
app.delete("/api/housemates/:name",(req,res)=>{people=people.filter(p=>p.name!==decodeURIComponent(req.params.name));emitState();res.json({ok:true});});
app.post("/api/reset",(req,res)=>{people.forEach(p=>p.votes=0);log("Vote totals reset");emitState();res.json({ok:true});});
app.post("/api/connect",async(req,res)=>{
 if(connection){try{await connection.disconnect()}catch{} connection=null;connected=false}
 if(!config.username)return res.status(400).json({error:"Enter a TikTok username"});
 try{
 connection=new TikTokLiveConnection(config.username,{enableExtendedGiftInfo:true});
 connection.on(WebcastEvent.CHAT,e=>{
  let text=String(e.comment||"").trim().toUpperCase();
  let match=people.find(p=>p.name===text);
  if(match){selections.set(String(e.user.userId),{name:match.name,at:Date.now(),nickname:e.user.nickname});log(`${e.user.nickname} selected ${match.name}`);emitState();}
 });
 connection.on(WebcastEvent.GIFT,e=>{
  let gift=String(e.gift?.name||e.extendedGiftInfo?.name||"");
  if(gift.toLowerCase()!==config.giftName.toLowerCase())return;
  if(e.gift?.streakable && e.streaking)return;
  let uid=String(e.user?.userId||"");let s=selections.get(uid);
  if(!s || Date.now()-s.at>config.commentWindowSec*1000){log(`Gift ${gift} from ${e.user?.nickname||"viewer"} not credited: no recent housemate selection`);return;}
  let p=people.find(x=>x.name===s.name);if(!p)return;
  let count=Number(e.repeatCount||1);p.votes+=config.voteValue*count;
  log(`${e.user?.nickname||"viewer"} sent ${gift} ×${count} → ${p.name} +${config.voteValue*count}`);
  selections.delete(uid);emitState();
 });
 connection.on("connected",()=>{connected=true;log("Connected to LIVE");emitState();});
 connection.on("disconnected",()=>{connected=false;log("Disconnected");emitState();});
 await connection.connect();connected=true;log("Connection started for @"+config.username);emitState();res.json({ok:true});
 }catch(err){connected=false;log("Connection error: "+err.message);emitState();res.status(500).json({error:err.message});}
});
app.post("/api/disconnect",async(req,res)=>{if(connection){try{await connection.disconnect()}catch{}connection=null;}connected=false;log("Disconnected by admin");emitState();res.json({ok:true});});
io.on("connection",socket=>{socket.emit("state",{people:people.slice().sort((a,b)=>b.votes-a.votes),config,connected,eventLog});});
const port=process.env.PORT||3000;server.listen(port,()=>console.log("Mobile Fan Vote running on "+port));
