# Parametric Studio CNC V1.2.1 Main App

This package promotes the uploaded V1.2.1 files to the main live app.

URLs after deployment:

- Free app: `https://parametricstudio.net/`
- Full app: `https://parametricstudio.net/app/`

Important:

- `index.html` is the free app.
- `app/index.html` is the full app with the Gumroad activation screen added.
- Keep your existing Netlify `ACTIVATION_SECRET` unchanged.
- The full app will skip the activation screen on a browser that already has a valid saved activation token.
- To test the activation screen, use an incognito/private window or open `/app/?resetActivation=1`.
