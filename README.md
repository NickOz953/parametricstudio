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

## Activation

The paid/full app at `app/index.html` includes the Gumroad activation screen.

To force-test the activation screen after deployment, open:

```text
https://parametricstudio.net/app/?resetActivation=1
```

Keep your existing Netlify environment variable unchanged:

- `ACTIVATION_SECRET`

Do not change the `ACTIVATION_SECRET` unless you intentionally want saved activations to expire.
