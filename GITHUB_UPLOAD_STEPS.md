# GitHub upload steps

1. Download and unzip this package.
2. Open your existing GitHub repository for Parametric Studio.
3. Upload/replace all files and folders from this package, keeping the same folder structure.
4. Commit the changes.
5. Netlify should redeploy automatically.
6. After Netlify finishes, test:

- `https://parametricstudio.net/`
- `https://parametricstudio.net/app/`

Do not change your Netlify `ACTIVATION_SECRET` unless you want existing saved activations to expire early.
