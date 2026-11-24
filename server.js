"use strict";

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const CHANNEL_URL = process.env.CHANNEL_URL || "";
const DATA_DIR = process.env.DATA_DIR || (process.env.FADEHOST ? "/data/sherry-x-links-zone" : path.join(__dirname, "data"));
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a strong password of at least 12 characters.");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random secret of at least 32 characters.");
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", { mode: 0o600 });

function readItems() {
  try {
    const value = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    console.error("Could not read submissions file; refusing to overwrite it.");
    throw new Error("Storage read failed");
  }
}
function writeItems(items) {
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
  fs.renameSync(temp, DATA_FILE);
}
function hashAddress(req) {
  // Store a keyed, non-reversible identifier rather than a raw IP address.
  return crypto.createHmac("sha256", SESSION_SECRET)
    .update(String(req.ip || req.socket.remoteAddress || "unknown"))
    .digest("hex");
}
function validInvite(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "chat.whatsapp.com" || parsed.hostname === "www.chat.whatsapp.com") &&
      /^\/[A-Za-z0-9_-]{10,}$/.test(parsed.pathname);
  } catch { return false; }
}

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
}}));
app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: false, limit: "12kb" }));
app.use(session({
  name: "sherry_admin",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: "auto", maxAge: 4 * 60 * 60 * 1000 }
}));

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
function adminOnly(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: "Admin login required." });
  next();
}

app.get("/api/config", (req, res) => res.json({
  channelUrl: CHANNEL_URL,
  channelReady: /^https:\/\/whatsapp\.com\/channel\//.test(CHANNEL_URL)
}));

app.post("/api/submit", submitLimiter, (req, res) => {
  const groupName = String(req.body.groupName || "").trim();
  const category = String(req.body.category || "").trim();
  const inviteLink = String(req.body.inviteLink || "").trim();
  const description = String(req.body.description || "").trim();

  if (groupName.length < 2 || groupName.length > 60) return res.status(400).json({ error: "Group name must be 2–60 characters." });
  const allowed = ["Study", "Technology", "Gaming", "Entertainment", "Community", "Other"];
  if (!allowed.includes(category)) return res.status(400).json({ error: "Choose a valid category." });
  if (!validInvite(inviteLink)) return res.status(400).json({ error: "Enter a valid https://chat.whatsapp.com/ invite link." });
  if (description.length > 180) return res.status(400).json({ error: "Description must be 180 characters or fewer." });

  const items = readItems();
  const normalized = inviteLink.replace(/\/+$/, "");
  if (items.some(x => x.inviteLink === normalized)) return res.status(409).json({ error: "This invite link has already been submitted." });

  const submitterHash = hashAddress(req);
  const recent = items.find(x => x.submitterHash === submitterHash && Date.now() - x.createdAt < 24 * 60 * 60 * 1000);
  if (recent) return res.status(429).json({ error: "You can submit one group link every 24 hours from this connection." });

  const item = {
    id: crypto.randomUUID(),
    groupName, category, inviteLink: normalized, description,
    status: "pending",
    createdAt: Date.now(),
    submitterHash
  };
  items.unshift(item);
  writeItems(items);
  res.status(201).json({ message: "Submitted successfully. Your link is waiting for admin review." });
});

app.post("/api/admin/login", loginLimiter, (req, res) => {
  const password = String(req.body.password || "");
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start admin session." });
    req.session.admin = true;
    req.session.csrf = crypto.randomBytes(24).toString("hex");
    res.json({ csrf: req.session.csrf });
  });
});
app.get("/api/admin/me", adminOnly, (req, res) => res.json({ csrf: req.session.csrf }));
function csrfOnly(req, res, next) {
  if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf) return res.status(403).json({ error: "Security token check failed. Refresh and log in again." });
  next();
}
app.post("/api/admin/logout", adminOnly, csrfOnly, (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out." }));
});
app.get("/api/admin/submissions", adminOnly, (req, res) => {
  const items = readItems().map(({ submitterHash, ...safe }) => safe);
  res.json(items);
});
app.post("/api/admin/submissions/:id/status", adminOnly, csrfOnly, (req, res) => {
  const status = String(req.body.status || "");
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const items = readItems();
  const item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Submission not found." });
  item.status = status;
  item.reviewedAt = Date.now();
  writeItems(items);
  res.json({ message: `Submission ${status}.` });
});
app.delete("/api/admin/submissions/:id", adminOnly, csrfOnly, (req, res) => {
  const items = readItems();
  const next = items.filter(x => x.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ error: "Submission not found." });
  writeItems(next);
  res.json({ message: "Deleted." });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("/health", (req, res) => res.json({ ok: true }));
app.listen(PORT, "0.0.0.0", () => console.log(`SHERRY X LINKS ZONE listening on ${PORT}`));
