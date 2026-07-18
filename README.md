# Parametric Studio CNC V1.2.10

- `index.html` â€” free app at `https://parametricstudio.net/`
- `app/index.html` â€” paid app with Gumroad activation at `https://parametricstudio.net/app/`
- `netlify/functions/` â€” activation and saved-token validation

Keep the existing Netlify `ACTIVATION_SECRET` unchanged. Upload the extracted contents to the existing GitHub repository root; Netlify will deploy from GitHub.

To force the activation screen during testing, open `/app/?resetActivation=1`.