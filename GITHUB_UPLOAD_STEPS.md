# GitHub Upload Steps

1. Extract this ZIP file on your computer.
2. Open your existing Parametric Studio GitHub repository.
3. Upload/replace the files and folders from this package:
   - `index.html`
   - `app/index.html`
   - `netlify/functions/activate.js`
   - `netlify/functions/check-activation.js`
   - `netlify.toml`
   - `README.md`
   - `.gitignore`
4. Commit the changes.
5. Wait for Netlify to finish redeploying.
6. Test these pages:
   - `https://parametricstudio.net/`
   - `https://parametricstudio.net/app/`

Do not change your Netlify `ACTIVATION_SECRET` unless you intentionally want existing saved activations to become invalid.
