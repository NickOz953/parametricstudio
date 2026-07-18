const crypto = require("crypto");

const GUMROAD_PRODUCT_ID = "sEsfR36xUUenuBEfx8vqCA==";
const ACTIVATION_DAYS = Number(process.env.ACTIVATION_DAYS || "30");

function jsonResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();

  if (!value.includes("@")) return value;

  const parts = value.split("@");
  const local = parts[0];
  const domain = parts[1];

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return local.split("+")[0].replace(/\./g, "") + "@gmail.com";
  }

  return value;
}

function base64url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function hashLicenseKey(licenseKey) {
  return crypto.createHash("sha256").update(String(licenseKey || "").trim()).digest("hex");
}

function sign(encodedPayload, secret) {
  return base64url(crypto.createHmac("sha256", secret).update(encodedPayload).digest());
}

function createActivationToken(payload, secret) {
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return encodedPayload + "." + signature;
}

async function verifyWithGumroad(licenseKey) {
  const body = new URLSearchParams();
  body.append("product_id", GUMROAD_PRODUCT_ID);
  body.append("license_key", licenseKey);
  body.append("increment_uses_count", "false");

  const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  return data;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse({ valid: false, message: "Method not allowed." }, 405);
  }

  const activationSecret = process.env.ACTIVATION_SECRET;

  if (!activationSecret || activationSecret.length < 24) {
    return jsonResponse({
      valid: false,
      message: "Server setup error: ACTIVATION_SECRET is missing or too short in Netlify."
    }, 500);
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse({ valid: false, message: "Invalid request." }, 400);
  }

  const email = normalizeEmail(body.email);
  const licenseKey = String(body.serial || body.licenseKey || "").trim();

  if (!email || !licenseKey) {
    return jsonResponse({
      valid: false,
      message: "Please enter both your Gumroad email and serial number/license key."
    }, 400);
  }

  try {
    const gumroadData = await verifyWithGumroad(licenseKey);

    if (gumroadData.success !== true) {
      return jsonResponse({
        valid: false,
        message: "Gumroad rejected this license: " + (gumroadData.message || "Please check the serial number/license key.")
      });
    }

    const purchase = gumroadData.purchase || {};
    const gumroadEmail = normalizeEmail(purchase.email);

    if (purchase.refunded === true || purchase.chargebacked === true) {
      return jsonResponse({
        valid: false,
        message: "This Gumroad purchase is no longer valid."
      });
    }

    if (gumroadEmail && email !== gumroadEmail) {
      return jsonResponse({
        valid: false,
        message: "The license key is valid, but the email does not match the Gumroad purchase email."
      });
    }

    const now = Date.now();
    const expiresAt = now + ACTIVATION_DAYS * 24 * 60 * 60 * 1000;

    const token = createActivationToken({
      v: 1,
      productId: GUMROAD_PRODUCT_ID,
      email: gumroadEmail || email,
      licenseHash: hashLicenseKey(licenseKey),
      issuedAt: now,
      expiresAt
    }, activationSecret);

    return jsonResponse({
      valid: true,
      message: "License verified.",
      token,
      expiresAt,
      activationDays: ACTIVATION_DAYS
    });
  } catch (error) {
    return jsonResponse({
      valid: false,
      message: "Could not contact Gumroad. Please try again."
    }, 500);
  }
};
