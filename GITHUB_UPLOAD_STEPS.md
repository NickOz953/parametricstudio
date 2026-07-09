# GitHub Upload Steps for Parametric Studio V1.6

1. Download and extract this ZIP.
2. Open the extracted folder.
3. Upload the contents to the root of your existing GitHub repository.
4. Commit the changes.
5. Netlify should redeploy automatically.

## Make sure GitHub shows these paths

```text
index.html
app/index.html
netlify/functions/activate.js
netlify/functions/check-activation.js
netlify.toml
```

## Important

Do not change your Netlify `ACTIVATION_SECRET` unless you want all users to re-activate sooner.

Do not create a new Gumroad product if you want existing customers' license keys to keep working. Keep using the same Gumroad product ID:

```text
sEsfR36xUUenuBEfx8vqCA==
```

## Test after deploy

Free version:

```text
https://parametricstudio.net/
```

Full paid version:

```text
https://parametricstudio.net/app/
```
