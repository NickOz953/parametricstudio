# Parametric Studio CNC V1.2.2 Deployment Package

This package is ready to upload to your existing GitHub repository connected to Netlify.

## Live URLs

- Free version: `https://parametricstudio.net/`
- Paid/full version: `https://parametricstudio.net/app/`

## Folder structure

```text
index.html
app/index.html
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

## Activation test

After deployment, test the full app activation screen with:

```text
https://parametricstudio.net/app/?resetActivation=1
```
