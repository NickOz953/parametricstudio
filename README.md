# Parametric Studio CNC V1.0 Deployment Package

This package is ready to upload to your existing GitHub repository connected to Netlify.

## What each file does

- `index.html` is the free version at `https://parametricstudio.net/`
- `app/index.html` is the paid/full version at `https://parametricstudio.net/app/`
- `netlify/functions/activate.js` verifies Gumroad licenses and issues 30-day activation tokens
- `netlify/functions/check-activation.js` checks saved activation tokens
- `netlify.toml` maps `/api/activate` and `/api/check-activation` to the Netlify Functions

## Important Netlify environment variables

Keep your existing `ACTIVATION_SECRET` exactly the same so current users are not forced to reactivate early.

Optional:

- `ACTIVATION_DAYS=30`

The Gumroad product ID is hardcoded in the functions:

`sEsfR36xUUenuBEfx8vqCA==`

## After upload

Netlify should automatically redeploy after you commit these files to GitHub.
