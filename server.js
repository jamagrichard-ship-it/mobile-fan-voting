import express from "express";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLive, label } from "ttl-live";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const server = http.createServer(app);
const io = new Server(server);

let people = [];
let config = { username: "", giftName: "Rose", voteValue: 1, commentWindowSec: 60 };
let connection = null;
let connected = false;
let eventLog = [];
const selections = new Map();

function log(message) {
  eventLog.unshift({ time: new Date().toLocaleTimeString(), message });
  eventLog = eventLog.slice(0, 80);
  io.emit("log", eventLog);
}
function emitState() {
  io.emit("state", { people: people.slice().sort((a,b) => b.votes-a.votes), config, connected, eventLog });
}
function viewerKey(user) {
  try { return String(label(user) || user?.uniqueId || user?.userId || user?.id || "").trim().toLowerCase(); }
  catch { return String(user?.uniqueId || user?.userId || user?.id || "").trim().toLowerCase(); }
}

app.get("/api/state", (req,res) => res.json({ people, config, connected, eventLog }));
app.post("/api/config", (req,res) => {
  const { username, giftName, voteValue, commentWindowSec } = req.body || {};
  config.username = String(username || "").replace(/^@/, "").trim();
  config.giftName = String(giftName || "Rose").trim();
  config.voteValue = Math.max(1, Number(voteValue) || 1);
  config.commentWindowSec = Math.max(10, Number(commentWindowSec) || 60);
  emitState(); res.json({ ok:true });
});
app.post("/api/housemates", (req,res) => {
  const name = String(req.body?.name || "").trim().toUpperCase();
  if (!name) return res.status(400).json({ error:"Name required" });
  if (people.some(p => p.name === name)) return res.status(409).json({ error:"Already exists" });
  people.push({ name, label:String(req.body?.label || "HOUSEMATE"), votes:0 });
  log("Added " + name); emitState(); res.json({ ok:true });
});
app.delete("/api/housemates/:name", (req,res) => {
  people = people.filter(p => p.name !== decodeURIComponent(req.params.name));
  emitState(); res.json({ ok:true });
});
app.post("/api/reset", (req,res) => {
  people.forEach(p => p.votes = 0);
  log("Vote totals reset"); emitState(); res.json({ ok:true });
});
app.post("/api/connect", async (req,res) => {
  if (connection) {
    try { await connection.disconnect(); } catch {}
    connection = null; connected = false;
  }
  if (!config.username) return res.status(400).json({ error:"Enter a TikTok username" });

  try {
    const live = new TikTokLive(config.username);
    connection = live;

    live.on("connected", () => { connected = true; log("Connected to LIVE"); emitState(); });
    live.on("disconnected", () => { connected = false; log("Disconnected"); emitState(); });
    live.on("error", err => { log("LIVE error: " + (err?.message || String(err))); emitState(); });

    live.on("chat", event => {
      const text = String(event?.comment || "").trim().toUpperCase();
      const match = people.find(p => p.name === text);
      if (!match) return;
      const key = viewerKey(event?.user);
      if (!key) return;
      selections.set(key, { name:match.name, at:Date.now() });
      log(`Viewer selected ${match.name}`);
      emitState();
    });

    live.on("gift", event => {
      const gift = String(event?.giftName || "").trim();
      if (gift.toLowerCase() !== config.giftName.toLowerCase()) return;
      if (event?.streakable && !event?.repeatEnd) return;
      const key = viewerKey(event?.user);
      const selection = selections.get(key);
      if (!selection || Date.now() - selection.at > config.commentWindowSec * 1000) {
        log(`Gift ${gift} not credited (no valid recent selection)`);
        return;
      }
      const target = people.find(p => p.name === selection.name);
      if (!target) return;
      const count = Math.max(1, Number(event?.repeatCount) || 1);
      target.votes += config.voteValue * count;
      log(`${gift} ×${count} credited to ${target.name}`);
      selections.delete(key);
      emitState();
    });

    await live.connect();
    connected = true; emitState();
    res.json({ ok:true });
  } catch (err) {
    connected = false; log("Connection error: " + (err?.message || String(err)));
    emitState(); res.status(500).json({ error:err?.message || String(err) });
  }
});
app.post("/api/disconnect", async (req,res) => {
  if (connection) { try { await connection.disconnect(); } catch {} connection = null; }
  connected = false; log("Disconnected by admin"); emitState(); res.json({ ok:true });
});
io.on("connection", socket => socket.emit("state", { people:people.slice().sort((a,b)=>b.votes-a.votes), config, connected, eventLog }));

const port = process.env.PORT || 3000;
server.listen(port, () => console.log("Mobile Fan Vote running on " + port));
