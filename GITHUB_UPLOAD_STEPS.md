# GitHub Upload Steps

1. Unzip this package.
2. Open your existing GitHub repository.
3. Upload the contents of this unzipped folder into the root of the repository.
4. Let GitHub replace existing files with the same names.
5. Commit the changes.
6. Netlify should redeploy automatically.

After deployment, test:

- `https://parametricstudio.net/`
- `https://parametricstudio.net/app/`
- `https://parametricstudio.net/app/?resetActivation=1`

Do not change your existing Netlify `ACTIVATION_SECRET`.
