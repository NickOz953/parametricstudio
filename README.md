# Parametric Studio CNC V1.1

This repository is ready for GitHub + Netlify deployment.

## URLs

- `/` — free version
- `/app/` — paid/full version with Gumroad serial activation

## Netlify environment variables

Keep your existing `ACTIVATION_SECRET` unchanged. Changing it will force existing activated users to re-enter their Gumroad email and license key.

Optional:

```text
ACTIVATION_DAYS=30
```

The Gumroad product ID is hardcoded in the Netlify functions:

```text
sEsfR36xUUenuBEfx8vqCA==
```

## Files

```text
index.html
app/index.html
netlify/functions/activate.js
netlify/functions/check-activation.js
netlify.toml
```
