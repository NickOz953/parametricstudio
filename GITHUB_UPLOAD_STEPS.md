# Upload steps

1. Unzip this package.
2. Open your existing GitHub repository for Parametric Studio.
3. Upload/replace these files and folders:
   - `index.html`
   - `app/index.html`
   - `netlify/functions/activate.js`
   - `netlify/functions/check-activation.js`
   - `netlify.toml`
   - `README.md`
4. Commit the changes.
5. Wait for Netlify to finish deploying.
6. Test:
   - `https://parametricstudio.net/`
   - `https://parametricstudio.net/app/`

Do not change your Netlify `ACTIVATION_SECRET` unless you want existing users to reactivate.
