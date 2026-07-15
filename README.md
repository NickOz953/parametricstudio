# Parametric Studio CNC V1.2 Deployment Package

This package is ready to upload to your existing GitHub repository connected to Netlify.

## Live URLs

- Free version: `https://parametricstudio.net/`
- Current paid/full version: `https://parametricstudio.net/app/`
- Legacy paid/full V1.1 version: `https://parametricstudio.net/app/legacy/V1.1/`

## Folder structure

```text
index.html
app/index.html
app/legacy/V1.1/index.html
netlify/functions/activate.js
netlify/functions/check-activation.js
netlify.toml
```

## Netlify settings

Keep your existing Netlify environment variable unchanged:

- `ACTIVATION_SECRET`

The Gumroad Product ID remains hardcoded in `netlify/functions/activate.js`:

```text
sEsfR36xUUenuBEfx8vqCA==
```

Do not change the `ACTIVATION_SECRET` unless you intentionally want all saved activations to expire.
