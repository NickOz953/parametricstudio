# Parametric Studio CNC Version 2.1 â€” Live `/app/` Deployment

This package replaces the live paid application at `https://parametricstudio.net/app/` and protects it with server-side Gumroad email and serial-number authentication.

The full application HTML is stored inside the `app-access` Netlify Function and is not published as a directly accessible static file. Unauthenticated visitors receive the login page. Successful authentication creates an HttpOnly, Secure browser cookie scoped to `/app/`.

## Required Netlify settings

- Keep the existing `ACTIVATION_SECRET` unchanged and at least 24 characters long.
- Keep `GUMROAD_PRODUCT_ID` set to the existing product, or allow the existing code fallback.
- Optional: `ACTIVATION_DAYS` controls the login period from 1â€“30 days and defaults to 30.

## Important

Keep the GitHub repository private if the application source should not be publicly readable in the repository. Existing users will need to enter their Gumroad email and license once after this deployment because the new live app uses a secure HttpOnly cookie.