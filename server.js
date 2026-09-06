import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3Pkg from "sqlite3";

const sqlite3 = sqlite3Pkg.verbose();
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ================= DATABASE INITIALIZATION =================
let db;
const dbFilePath = path.join(__dirname, "careconnect.db");

function initializeDatabase() {
  db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
      console.warn("⚠️ File-based SQLite error (sandbox or lock), falling back to in-memory SQLite:", err.message);
      db = new sqlite3.Database(":memory:", (memErr) => {
        if (memErr) {
          console.error("❌ Memory SQLite connection failed:", memErr.message);
        } else {
          console.log(" Connected to in-memory SQLite Database");
          setupTablesAndSeed();
        }
      });
    } else {
      console.log(" Connected to Persistent SQLite Database (careconnect.db)");
      setupTablesAndSeed();
    }
  });
}

function setupTablesAndSeed() {
  db.serialize(() => {
    // 1. Create table
    db.run(`
      CREATE TABLE IF NOT EXISTS triage_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        patientName TEXT,
        phone TEXT,
        village TEXT,
        medicationTaken INTEGER,
        reportedSymptoms TEXT,
        requestedHomeVisit INTEGER,
        triageLevel TEXT,
        clinicalSummary TEXT,
        status TEXT,
        assignedWorker TEXT
      )
    `);

    // 2. Check if seeded; if empty, insert realistic rural PHC records
    db.get("SELECT COUNT(*) as count FROM triage_records", [], (err, row) => {
      if (!err && row && row.count === 0) {
        console.log(" Seeding initial rural triage records...");
        const seedStmt = db.prepare(`
          INSERT INTO triage_records (id, timestamp, patientName, phone, village, medicationTaken, reportedSymptoms, requestedHomeVisit, triageLevel, clinicalSummary, status, assignedWorker)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const seeds = [
          [
            "TR-8821",
            "09:15 AM",
            "Anita Devi (ANC 28-Wk)",
            "+91 98765-43210",
            "Sonpur Ward 2",
            0,
            "High Fever, Dizziness",
            1,
            "RED",
            "Third-trimester maternal check-in. Reports persistent high-grade fever since midnight and acute postural dizziness. Missed iron-folic acid and BP medication.",
            "URGENT_ANM_DISPATCH",
            "Unassigned"
          ],
          [
            "TR-8819",
            "08:50 AM",
            "Kamla Devi (Elderly Care)",
            "+91 98112-33445",
            "Sonpur Ward 1",
            1,
            "Severe Headache",
            0,
            "AMBER",
            "Hypertension follow-up. Morning Amlodipine confirmed taken. Complains of throbbing headache and minor vision blur. ANM evaluation recommended.",
            "IN_REVIEW",
            "Unassigned"
          ],
          [
            "TR-8814",
            "08:15 AM",
            "Rameshwar Singh",
            "+91 97001-22334",
            "Kalyanpur",
            1,
            "None reported",
            0,
            "GREEN",
            "Post-discharge recovery check-in. Diabetic medication adherence verified. No pain or fever. Routine monitoring continued.",
            "RESOLVED",
            "Sunita Devi (ANM)"
          ]
        ];

        for (const s of seeds) {
          seedStmt.run(s);
        }
        seedStmt.finalize(() => {
          console.log(" Seed data successfully populated into triage_records.");
        });
      }
    });
  });
}

initializeDatabase();

// ================= IN-MEMORY MOCK STORE FOR 2FACTOR DEMO =================
const mockOtpSessions = new Map();

// ================= 2FACTOR.IN VOICE OTP API ROUTES =================

// 1. POST /api/auth/send-voice-otp
app.post("/api/auth/send-voice-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone number is required." });
    }

    const cleanPhone = phone.toString().replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: "Please enter a valid 10-digit Indian phone number." });
    }

    const apiKey = process.env.TWOFACTOR_API_KEY;

    // Real 2Factor.in OBD Voice API call if valid API key is present
    if (apiKey && apiKey.trim() && apiKey !== "your_2factor_api_key_here") {
      const url = `https://2factor.in/API/V1/${apiKey.trim()}/VOICE/${cleanPhone}/AUTOGEN`;
      console.log(`[2Factor.in] Dispatching outbound Voice OTP call to +91 ${cleanPhone}...`);
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === "Success") {
        console.log(`[2Factor.in] Voice Call Dispatched! Session ID: ${data.Details}`);
        return res.status(200).json({ success: true, sessionId: data.Details });
      } else {
        console.warn(`[2Factor.in] API Error:`, data);
        return res.status(400).json({ success: false, error: data.Details || "Failed to dispatch voice call" });
      }
    }

    // Graceful Offline / Demo Mock Fallback
    const mockSessionId = "MOCK-SESS-" + Math.floor(100000 + Math.random() * 900000);
    const mockOtp = String(Math.floor(100000 + Math.random() * 900000));
    mockOtpSessions.set(mockSessionId, mockOtp);

    setTimeout(() => mockOtpSessions.delete(mockSessionId), 10 * 60 * 1000);

    console.log(`\n======================================================`);
    console.log(`📞 [2Factor.in Voice OTP Simulator] (Demo Mode)`);
    console.log(` Recipient Phone: +91 ${cleanPhone}`);
    console.log(` Session ID:      ${mockSessionId}`);
    console.log(` 🔑 Voice OTP:     >>> ${mockOtp} <<< (or use 123456)`);
    console.log(`======================================================\n`);

    return res.status(200).json({
      success: true,
      sessionId: mockSessionId,
      demoMode: true,
      demoOtp: mockOtp,
      message: "Voice call simulation initiated. OTP logged to server terminal."
    });
  } catch (err) {
    console.error("send-voice-otp error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/auth/verify-voice-otp
app.post("/api/auth/verify-voice-otp", async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) {
      return res.status(400).json({ authenticated: false, error: "Session ID and OTP are required." });
    }

    const cleanOtp = otp.toString().trim();
    const apiKey = process.env.TWOFACTOR_API_KEY;

    // Handle Mock / Demo mode verification
    if (sessionId.startsWith("MOCK-SESS-") || !apiKey || apiKey === "your_2factor_api_key_here") {
      const storedOtp = mockOtpSessions.get(sessionId);
      if (cleanOtp === storedOtp || cleanOtp === "123456") {
        mockOtpSessions.delete(sessionId);
        console.log(`✅ [2Factor.in Mock] OTP verified successfully for session: ${sessionId}`);
        return res.status(200).json({ authenticated: true, message: "Phone number verified" });
      } else {
        return res.status(401).json({ authenticated: false, error: "Invalid OTP. Please check the voice call and try again." });
      }
    }

    // Real 2Factor.in Verification
    const url = `https://2factor.in/API/V1/${apiKey.trim()}/VOICE/VERIFY/${sessionId}/${cleanOtp}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Status === "Success" || data.Details === "OTP Matched" || (typeof data.Details === "string" && data.Details.toLowerCase().includes("matched"))) {
      console.log(`✅ [2Factor.in] OTP Matched successfully for session: ${sessionId}`);
      return res.status(200).json({ authenticated: true, message: "Phone number verified" });
    } else {
      console.warn(`❌ [2Factor.in] Verification failed:`, data);
      return res.status(401).json({ authenticated: false, error: data.Details || "Invalid OTP" });
    }
  } catch (err) {
    console.error("verify-voice-otp error:", err);
    return res.status(500).json({ authenticated: false, error: err.message });
  }
});

// ================= API ROUTES =================

// 1. GET all clinical triage records (Used by Doctor Portal & Test Desk)
app.get("/api/triage-records", (req, res) => {
  db.all("SELECT * FROM triage_records ORDER BY rowid DESC", [], (err, rows) => {
    if (err) {
      console.error("Fetch records error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json({ records: rows || [] });
  });
});

// 2. POST create new triage record (Transfers data from Website 1 to Database)
app.post("/api/triage-records", (req, res) => {
  const {
    patientName,
    phone,
    village,
    medicationTaken,
    reportedSymptoms,
    requestedHomeVisit,
    clinicalSummary,
    triageLevel
  } = req.body;

  if (!patientName) {
    return res.status(400).json({ error: "patientName is required." });
  }

  // Generate clean ID & timestamp
  const id = "TR-" + Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Intelligent triage calculation if not explicitly provided
  let calculatedLevel = (triageLevel || "").toUpperCase();
  const symLower = (reportedSymptoms || "").toLowerCase();

  if (!calculatedLevel) {
    const isDanger =
      symLower.includes("fever") ||
      symLower.includes("dizziness") ||
      symLower.includes("breathlessness") ||
      symLower.includes("chest pain");
    
    if (isDanger || (requestedHomeVisit && !medicationTaken)) {
      calculatedLevel = "RED";
    } else if (!medicationTaken || symLower.includes("headache") || symLower.includes("fatigue")) {
      calculatedLevel = "AMBER";
    } else {
      calculatedLevel = "GREEN";
    }
  }

  // Initial status based on urgency
  let initialStatus = "IN_REVIEW";
  if (calculatedLevel === "RED") {
    initialStatus = "URGENT_ANM_DISPATCH";
  } else if (calculatedLevel === "GREEN" && (reportedSymptoms === "None reported" || !reportedSymptoms)) {
    initialStatus = "RESOLVED";
  }

  const record = {
    id,
    timestamp: timeString,
    patientName: patientName.trim(),
    phone: (phone || "+91 98000-00000").trim(),
    village: (village || "Sonpur Sector").trim(),
    medicationTaken: medicationTaken ? 1 : 0,
    reportedSymptoms: reportedSymptoms || "None reported",
    requestedHomeVisit: requestedHomeVisit ? 1 : 0,
    triageLevel: calculatedLevel,
    clinicalSummary: clinicalSummary || "Voice intake record transferred from Website 1.",
    status: initialStatus,
    assignedWorker: calculatedLevel === "GREEN" ? "Sunita Devi (ANM)" : "Unassigned"
  };

  const stmt = db.prepare(`
    INSERT INTO triage_records (id, timestamp, patientName, phone, village, medicationTaken, reportedSymptoms, requestedHomeVisit, triageLevel, clinicalSummary, status, assignedWorker)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    [
      record.id,
      record.timestamp,
      record.patientName,
      record.phone,
      record.village,
      record.medicationTaken,
      record.reportedSymptoms,
      record.requestedHomeVisit,
      record.triageLevel,
      record.clinicalSummary,
      record.status,
      record.assignedWorker
    ],
    function (err) {
      stmt.finalize();
      if (err) {
        console.error("❌ Failed to insert triage record:", err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log(`\n [CARECONNECT DB] New Triage Record Saved: ${record.id} (${record.patientName}) [${record.triageLevel}]`);
      return res.status(201).json({
        success: true,
        message: "Record successfully persisted in database",
        record
      });
    }
  );
});

// 3. PATCH update case status or assign ANM (Doctor Portal)
app.patch("/api/triage-records/:id", (req, res) => {
  const { id } = req.params;
  const { status, assignedWorker } = req.body;

  db.run(
    `UPDATE triage_records 
     SET status = COALESCE(?, status), 
         assignedWorker = COALESCE(?, assignedWorker) 
     WHERE id = ?`,
    [status, assignedWorker, id],
    function (err) {
      if (err) {
        console.error("Update record error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json({ success: true, updatedId: id, changes: this.changes });
    }
  );
});

// 4. POST Vapi Voice AI Webhook Ingestion
app.post("/api/vapi-webhook", (req, res) => {
  const message = req.body.message;

  if (message && message.type === "tool-calls") {
    const toolCalls = message.toolCalls || [];
    const results = [];

    for (const toolCall of toolCalls) {
      if (toolCall.function && toolCall.function.name === "record_triage_submission") {
        const args = toolCall.function.arguments || {};
        const id = "TR-" + Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const triageLevel = (args.triage_status || "GREEN").toUpperCase();
        const record = {
          id,
          timestamp: timeString,
          patientName: args.respondent_type ? args.respondent_type.toUpperCase() + " (Patient)" : "Rural Voice Caller",
          phone: "+91 98765-43210",
          village: "Sonpur Ward 2",
          medicationTaken: args.morning_medications_taken ? 1 : 0,
          reportedSymptoms: Array.isArray(args.danger_symptoms) && args.danger_symptoms.length > 0
            ? args.danger_symptoms.join(", ")
            : "None reported",
          requestedHomeVisit: args.needs_anm_visit ? 1 : 0,
          triageLevel,
          clinicalSummary: args.notes || "Live Vapi voice triage session completed.",
          status: triageLevel === "RED" ? "URGENT_ANM_DISPATCH" : "IN_REVIEW",
          assignedWorker: "Unassigned"
        };

        const stmt = db.prepare(`
          INSERT INTO triage_records (id, timestamp, patientName, phone, village, medicationTaken, reportedSymptoms, requestedHomeVisit, triageLevel, clinicalSummary, status, assignedWorker)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          [
            record.id,
            record.timestamp,
            record.patientName,
            record.phone,
            record.village,
            record.medicationTaken,
            record.reportedSymptoms,
            record.requestedHomeVisit,
            record.triageLevel,
            record.clinicalSummary,
            record.status,
            record.assignedWorker
          ],
          (err) => {
            if (err) console.error("❌ Failed to insert Vapi webhook record:", err.message);
            else console.log("\n [VAPI WEBHOOK -> CARECONNECT DB] Record Saved:", record.id);
          }
        );
        stmt.finalize();

        results.push({
          toolCallId: toolCall.id,
          result: "Triage submission successfully saved in CareConnect database."
        });
      }
    }

    return res.status(200).json({ results });
  }

  return res.status(200).json({ status: "received" });
});

// ================= STATIC ROUTES FOR THE TWO WEBSITES =================
// Website 1: Patient Voice Calling & Intake Desk
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "test-desk.html")));
app.get("/patient", (req, res) => res.sendFile(path.join(__dirname, "test-desk.html")));
app.get("/test-desk.html", (req, res) => res.sendFile(path.join(__dirname, "test-desk.html")));

// Website 2: Doctor & ANM Clinical Command Portal
app.get("/doctor", (req, res) => res.sendFile(path.join(__dirname, "doctor-portal.html")));
app.get("/doctor-portal.html", (req, res) => res.sendFile(path.join(__dirname, "doctor-portal.html")));

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` CareConnect Connected Healthcare Server`);
  console.log(`======================================================`);
  console.log(` Website 1 (Patient Intake & Calling Desk): http://localhost:${PORT}/test-desk.html`);
  console.log(` Website 2 (Doctor & ANM Clinical Portal):  http://localhost:${PORT}/doctor-portal.html`);
  console.log(` Database: SQLite (triage_records table)`);
  console.log(`======================================================\n`);
});
