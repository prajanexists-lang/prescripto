# CareConnect — Connected Healthcare & ABDM Telehealth Platform

CareConnect is a closed-loop digital health and clinical teleconsultation platform built to bridge rural healthcare delivery with Ayushman Bharat Digital Mission (ABDM) standards and the Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP).

---

## 🌟 Key Features

### 1. Patient Health & Prescripto Desk
- **Prescription Scanner & AI OCR Digitizer**: Upload prescription slips to digitize brand medications, calculate generic salt substitutions, and project PMBJP cost savings (up to 85%+).
- **Dietary Drug-Interaction Warnings**: Context-aware clinical alerts against mixing iron, antibiotics, and psychotropic drugs with common Indian foods (e.g. tannic chai/tea, calcium-rich curd/dahi).
- **Jan Aushadhi Kendra GPS Locator**: Geolocation and pincode-driven directory with distance calculations and live ABDM inventory checks.
- **Two-Option Consultation Scheduling**:
  - Direct meet booking with connected primary physician.
  - Second opinion booking with specialist clinicians using unique clinician codes.
- **Voice OTP Verification**: Automated voice verification for passwordless onboarding.

### 2. Doctor Clinical Command Desk (`/doctor`)
- **Unique Clinician Code System**: Primary clinician code (e.g. `DOC-4829`) with 1-click clipboard copy to link patients directly into the doctor's repository.
- **Triage Worklist & Red Alert Priority Queue**: Real-time triage stream triaging incoming emergency visits and post-partum/chronic cases.
- **Prescription Verification & Dispensing Desk**: Review patient prescription uploads, accept or reject with clinical reasons, and notify patients via WhatsApp.
- **Telephony & Voice AI Collector**: Unified logging for voice interactions, outbound callbacks, and clinical notes.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (v9 or higher)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/<your-username>/careconnect-voice.git
cd careconnect-voice
npm install
```

### 3. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Configure your environment variables:
```env
PORT=8000
VAPI_ASSISTANT_ID="your-assistant-id-optional"
TWOFACTOR_API_KEY="your-voice-api-key-optional"
```

### 4. Run the Application
Start the server locally:
```bash
npm start
```

Access the portals in your browser:
- **Patient Portal**: [http://localhost:8000/](http://localhost:8000/)
- **Doctor Command Desk**: [http://localhost:8000/doctor](http://localhost:8000/doctor)

---

## ☁️ Cloud Production Deployment

This application is fully production-ready for deployment on **Render**, **Railway**, **Fly.io**, or **Heroku**:
- Automatically listens on `process.env.PORT` with `0.0.0.0` host binding.
- Standard `npm start` script executes `node server.cjs`.
- Sensitive credentials (`.env`), local databases (`careconnect.db`), and operating system caches (`.DS_Store`) are excluded via `.gitignore`.
