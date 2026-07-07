# Parametric Studio Netlify/GitHub Package

This package sets up:

- `https://parametricstudio.net/` as the free version homepage.
- `https://parametricstudio.net/app/` as the paid full version.
- Gumroad license activation for the paid version.
- A signed browser activation token that keeps the paid version unlocked for 30 days.

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

The paid version is configured to verify this Gumroad product ID:

```text
sEsfR36xUUenuBEfx8vqCA==
```

## Required Netlify environment variable

In Netlify, open your project and add this environment variable:

```text
ACTIVATION_SECRET
```

Use a long private value, at least 24 characters. Example:

```text
parametric-studio-private-activation-secret-2026-change-this
```

Do not put this secret in GitHub.

## Optional Netlify environment variables

You can also add:

```text
ACTIVATION_DAYS
```

Set it to:

```text
14
```

or:

```text
30
```

If you do not set it, the app defaults to 30 days.

You can also add this if you ever want to override the product ID without changing code:

```text
GUMROAD_PRODUCT_ID
```

## Customer flow

1. Visitor goes to `https://parametricstudio.net/`.
2. Visitor uses the free version.
3. Paid customer opens `https://parametricstudio.net/app/`.
4. Customer enters Gumroad email and serial/license key.
5. If valid, the browser stays activated for 30 days.
6. After 30 days, the customer is asked to activate again.
