const crypto = require("crypto");

const PRODUCT_ID = "sEsfR36xUUenuBEfx8vqCA==";
const DEFAULT_ACTIVATION_DAYS = 30;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2) return value;
  let [local, domain] = parts;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signPayload(payload, secret) {
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encodedPayload}.${signature}`;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });

  const secret = process.env.ACTIVATION_SECRET;
  if (!secret || secret.length < 24) {
    return json(500, { error: "Server setup error: ACTIVATION_SECRET is missing or too short." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { error: "Invalid request body." });
  }

  const email = normalizeEmail(body.email);
  const licenseKey = String(body.licenseKey || body.serial || "").trim();

  if (!email || !licenseKey) {
    return json(400, { error: "Email and license key are required." });
  }

  const form = new URLSearchParams();
  form.set("product_id", PRODUCT_ID);
  form.set("license_key", licenseKey);
  form.set("increment_uses_count", "false");

  let gumroadData;
  try {
    const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    gumroadData = await response.json();
  } catch (error) {
    return json(502, { error: "Could not reach Gumroad license server." });
  }

  if (!gumroadData || !gumroadData.success) {
    return json(401, { error: "Gumroad rejected this license key." });
  }

  const purchase = gumroadData.purchase || {};
  const purchaseEmail = normalizeEmail(purchase.email || "");
  if (purchaseEmail && purchaseEmail !== email) {
    return json(401, { error: "This email does not match the Gumroad purchase email." });
  }

  if (purchase.refunded || purchase.chargebacked) {
    return json(403, { error: "This purchase is no longer active." });
  }

  if (purchase.subscription_cancelled_at || purchase.subscription_failed_at) {
    return json(403, { error: "This subscription is not active." });
  }

  const now = Date.now();
  const days = Math.max(1, Number(process.env.ACTIVATION_DAYS || DEFAULT_ACTIVATION_DAYS));
  const expiresAt = now + days * 24 * 60 * 60 * 1000;
  const licenseHash = crypto.createHash("sha256").update(licenseKey).digest("hex");

  const token = signPayload({
    v: 1,
    productId: PRODUCT_ID,
    email,
    licenseHash,
    issuedAt: now,
    expiresAt
  }, secret);

  return json(200, { token, expiresAt });
};
