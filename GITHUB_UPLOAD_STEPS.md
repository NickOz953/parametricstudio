# GitHub Upload Steps

1. Unzip this package on your computer.
2. Open your existing Parametric Studio GitHub repository.
3. Upload the extracted contents to the root of the repository, replacing existing files when prompted.
4. Confirm these paths exist in GitHub:
   - `index.html`
   - `app/index.html`
   - `app/legacy/V1.1/index.html`
   - `netlify/functions/activate.js`
   - `netlify/functions/check-activation.js`
   - `netlify.toml`
5. Commit the changes.
6. Netlify should redeploy automatically.

After deployment:
- Free: `https://parametricstudio.net/`
- Paid V1.2: `https://parametricstudio.net/app/`
- Legacy paid V1.1: `https://parametricstudio.net/app/legacy/V1.1/`

Do not change your existing Netlify `ACTIVATION_SECRET`.
