const crypto = require("crypto");

const PRODUCT_ID = "sEsfR36xUUenuBEfx8vqCA==";

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

function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("Missing activation token.");
  }
  const [encodedPayload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const sigBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error("Invalid activation token.");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return payload;
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

  try {
    const payload = verifyToken(body.token, secret);
    if (payload.productId !== PRODUCT_ID) {
      return json(401, { valid: false, error: "Activation is for a different product." });
    }
    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      return json(401, { valid: false, error: "Activation expired." });
    }
    return json(200, { valid: true, expiresAt: payload.expiresAt, email: payload.email });
  } catch (error) {
    return json(401, { valid: false, error: error.message || "Invalid activation token." });
  }
};
