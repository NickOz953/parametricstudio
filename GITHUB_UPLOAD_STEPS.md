# GitHub Upload Steps

1. Download and extract this ZIP.
2. Open your GitHub repository.
3. Upload these files/folders to the root of the repo:

```text
index.html
app/
netlify/
netlify.toml
README.md
GITHUB_UPLOAD_STEPS.md
```

4. Commit the changes.
5. Netlify should redeploy automatically.

## Important

Make sure GitHub shows this exact folder/file path:

```text
netlify/functions/activate.js
netlify/functions/check-activation.js
```

## Netlify setup

In Netlify, add this environment variable:

```text
ACTIVATION_SECRET
```

Use a long private value.

Optional:

```text
ACTIVATION_DAYS
```

Set to `14` or `30`. If omitted, it defaults to `30`.

## URLs

Free version:

```text
https://parametricstudio.net/
```

Full paid version:

```text
https://parametricstudio.net/app/
```
