# Parametric Studio CNC V1.0

This is the GitHub/Netlify deployment package for Parametric Studio CNC V1.0.

## Live structure

- `/index.html` is the free public version.
- `/app/index.html` is the paid full version with Gumroad activation.
- `/netlify/functions/activate.js` verifies Gumroad license keys.
- `/netlify/functions/check-activation.js` checks saved 30-day activation tokens.

## Gumroad product ID

The Netlify Functions are hardcoded to use this product ID so an old Netlify environment variable cannot override it:

```text
sEsfR36xUUenuBEfx8vqCA==
```

## Required Netlify environment variable

You still need this Netlify environment variable:

```text
ACTIVATION_SECRET
```

Use a long private value of at least 24 characters. Keep the same value between deployments so existing activations continue working.

Optional:

```text
ACTIVATION_DAYS=30
```

## URLs

- Free version: `https://parametricstudio.net/`
- Paid version: `https://parametricstudio.net/app/`
