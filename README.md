# Parametric Studio V1.6 Netlify/GitHub Package

This package updates your existing Parametric Studio site to V1.6.

## What this deploys

- `https://parametricstudio.net/` = Parametric Studio V1.6 Free
- `https://parametricstudio.net/app/` = Parametric Studio V1.6 Full, protected by Gumroad serial activation

## File structure

```text
index.html
app/
  index.html
netlify/
  functions/
    activate.js
    check-activation.js
netlify.toml
README.md
GITHUB_UPLOAD_STEPS.md
```

## Gumroad product ID

The paid version verifies against this Gumroad product ID:

```text
sEsfR36xUUenuBEfx8vqCA==
```

This Product ID is hardcoded in `netlify/functions/activate.js` to avoid old Netlify environment variables overriding it.

## Required Netlify environment variable

Keep your existing Netlify environment variable:

```text
ACTIVATION_SECRET
```

Use a long private value, at least 24 characters. Do not put this secret in GitHub.

## Optional Netlify environment variable

```text
ACTIVATION_DAYS
```

Set it to `14` or `30`. If omitted, the app defaults to 30 days.

## Customer flow

1. Visitor opens `https://parametricstudio.net/` and uses the free V1.6 app.
2. Paid customer opens `https://parametricstudio.net/app/`.
3. Customer enters their Gumroad email and serial/license key.
4. If valid, the browser remains activated for the configured activation period.
