# Parametric Studio CNC V1.1

GitHub/Netlify deployment package for Parametric Studio CNC.

## Site structure

- `index.html` = free version at `https://parametricstudio.net/`
- `app/index.html` = paid/full version at `https://parametricstudio.net/app/`
- `netlify/functions/activate.js` = Gumroad license verification
- `netlify/functions/check-activation.js` = saved activation token check

## Netlify environment variables

Keep your existing Netlify environment variable:

- `ACTIVATION_SECRET` = your private activation secret

Optional:

- `ACTIVATION_DAYS` = number of days the activation stays valid, defaults to `30`

The Gumroad Product ID is hardcoded in the Netlify functions:

`sEsfR36xUUenuBEfx8vqCA==`
