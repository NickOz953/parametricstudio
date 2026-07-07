const crypto = require("crypto");

const GUMROAD_PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || "sEsfR36xUUenuBEfx8vqCA==";

function jsonResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function base64url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(value) {
  let base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf8");
}

function sign(encodedPayload, secret) {
  return base64url(crypto.createHmac("sha256", secret).update(encodedPayload).digest());
}

function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a || ""));
  const bBuffer = Buffer.from(String(b || ""));

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyActivationToken(token, secret) {
  const parts = String(token || "").split(".");

  if (parts.length !== 2) {
    return { valid: false, message: "Invalid activation token." };
  }

  const encodedPayload = parts[0];
  const suppliedSignature = parts[1];
  const expectedSignature = sign(encodedPayload, secret);

  if (!safeEqual(suppliedSignature, expectedSignature)) {
    return { valid: false, message: "Invalid activation signature." };
  }

  let payload;

  try {
    payload = JSON.parse(fromBase64url(encodedPayload));
  } catch (error) {
    return { valid: false, message: "Invalid activation data." };
  }

  if (payload.productId !== GUMROAD_PRODUCT_ID) {
    return { valid: false, message: "This activation is for a different product." };
  }

  if (!payload.expiresAt || Date.now() > Number(payload.expiresAt)) {
    return { valid: false, message: "Your saved activation has expired. Please activate again." };
  }

  return {
    valid: true,
    message: "Activation valid.",
    email: payload.email,
    expiresAt: payload.expiresAt
  };
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

  const result = verifyActivationToken(body.token, activationSecret);
  return jsonResponse(result, result.valid ? 200 : 200);
};
