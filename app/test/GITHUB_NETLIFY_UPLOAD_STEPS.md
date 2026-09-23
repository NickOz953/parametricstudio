# GitHub and Netlify deployment steps

1. Extract this ZIP.
2. Upload/merge all extracted contents into the root of the existing GitHub repository.
3. Replace the existing root `netlify.toml` with the included file, unless your repository contains other custom redirects. If it does, merge the `app-access` function setting and the three `/app` redirects before any catch-all redirects.
4. Commit the changes and wait for Netlify to finish deploying from GitHub.
5. Confirm the `app-access` function appears in Netlify's deployed functions list.
6. Keep the existing Netlify `ACTIVATION_SECRET` unchanged.
7. Test `https://parametricstudio.net/app/` in a private browser window with a real Gumroad purchase email and license key.
8. Confirm a bad email/key remains blocked, then close and reopen the browser to confirm the valid session remains active.