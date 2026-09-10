require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NOTCHPAY_BASE_URL = "https://api.notchpay.co";

const PUBLIC_KEY = process.env.NOTCHPAY_PUBLIC_KEY;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

if (!PUBLIC_KEY) {
  console.warn("⚠️ NOTCHPAY_PUBLIC_KEY n'est pas défini. Copie .env.example vers .env puis ajoute ta clé pk_test_...");
}

app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function normalizePhone(value) {
  let phone = String(value || "").replace(/[^\d+]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (phone.startsWith("237")) phone = "+" + phone;
  if (/^6\d{8}$/.test(phone)) phone = "+237" + phone;
  return phone;
}

function extractReference(payload) {
  return (
    payload?.payment?.reference ||
    payload?.transaction?.reference ||
    payload?.payment?.trxref ||
    payload?.transaction?.trxref ||
    payload?.reference ||
    payload?.trxref ||
    null
  );
}

function extractStatus(payload) {
  return String(
    payload?.transaction?.status ||
    payload?.payment?.status ||
    payload?.status ||
    ""
  ).toLowerCase();
}

async function notchRequest(url, options = {}) {
  const response = await fetch(`${NOTCHPAY_BASE_URL}${url}`, {
    ...options,
    headers: {
      Authorization: PUBLIC_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Notch Pay HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Houdini-Market Notch Pay Sandbox",
    configured: Boolean(PUBLIC_KEY)
  });
});

app.post("/api/notchpay/payment", async (req, res) => {
  try {
    if (!PUBLIC_KEY) {
      return res.status(500).json({
        message: "NOTCHPAY_PUBLIC_KEY n'est pas configurée sur le serveur."
      });
    }

    const amount = Number(req.body.amount);
    const phone = normalizePhone(req.body.phone);
    const channel = String(req.body.channel || "");
    const name = String(req.body.name || "Client Houdini-Market").trim();
    const email = String(req.body.email || "").trim();

    if (!Number.isInteger(amount) || amount < 100 || amount > 5000000) {
      return res.status(400).json({
        message: "Montant invalide. Utilise un montant entier entre 100 et 5 000 000 FCFA."
      });
    }

    if (!/^\+2376\d{8}$/.test(phone)) {
      return res.status(400).json({
        message: "Numéro camerounais invalide. Format attendu : +237XXXXXXXXX."
      });
    }

    if (!["cm.mtn", "cm.orange"].includes(channel)) {
      return res.status(400).json({
        message: "Canal de paiement invalide."
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Une adresse e-mail est nécessaire pour initialiser le paiement."
      });
    }

    const reference = `hm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Étape 1 : initialiser le paiement.
    const initialized = await notchRequest("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount,
        currency: "XAF",
        email,
        phone,
        customer: {
          name,
          email,
          phone
        },
        description: "Recharge du portefeuille Houdini-Market (Sandbox)",
        reference,
        locked_currency: "XAF",
        locked_channel: channel,
        locked_country: "CM"
      })
    });

    const paymentReference = extractReference(initialized) || reference;

    // Étape 2 : déclencher le paiement Mobile Money.
    const processed = await notchRequest(
      `/payments/${encodeURIComponent(paymentReference)}`,
      {
        method: "POST",
        body: JSON.stringify({
          channel,
          data: {
            phone
          }
        })
      }
    );

    res.json({
      ok: true,
      reference: paymentReference,
      status: extractStatus(processed) || "processing",
      transaction: processed?.transaction || processed?.payment || null
    });
  } catch (error) {
    console.error("Notch Pay payment error:", error.data || error.message);
    res.status(error.status || 500).json({
      message: error.message || "Erreur pendant l'initialisation du paiement."
    });
  }
});

app.get("/api/notchpay/status/:reference", async (req, res) => {
  try {
    if (!PUBLIC_KEY) {
      return res.status(500).json({
        message: "NOTCHPAY_PUBLIC_KEY n'est pas configurée sur le serveur."
      });
    }

    const reference = String(req.params.reference || "").trim();

    if (!reference || reference.length > 200) {
      return res.status(400).json({
        message: "Référence de paiement invalide."
      });
    }

    const data = await notchRequest(
      `/payments/${encodeURIComponent(reference)}`,
      { method: "GET" }
    );

    res.json({
      ok: true,
      reference,
      status: extractStatus(data) || "unknown",
      transaction: data?.transaction || data?.payment || null
    });
  } catch (error) {
    console.error("Notch Pay status error:", error.data || error.message);
    res.status(error.status || 500).json({
      message: error.message || "Impossible de vérifier le paiement."
    });
  }
});

// Sert le fichier Houdini-Market pour un test local simple.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index_paiement_notchpay.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Houdini-Market Notch Pay Sandbox`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
