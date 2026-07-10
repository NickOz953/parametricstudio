# Parametric Studio CNC V1.1

This package is ready for GitHub and Netlify deployment.

## Site structure

- `index.html` = free version at `https://parametricstudio.net/`
- `app/index.html` = paid/full version at `https://parametricstudio.net/app/`
- `netlify/functions/activate.js` = Gumroad license verification
- `netlify/functions/check-activation.js` = saved activation check

## Netlify environment variables

Keep your existing Netlify environment variable unchanged:

- `ACTIVATION_SECRET`

Optional:

- `ACTIVATION_DAYS` = `30`

The Gumroad Product ID is hardcoded in both Netlify functions:

`sEsfR36xUUenuBEfx8vqCA==`
