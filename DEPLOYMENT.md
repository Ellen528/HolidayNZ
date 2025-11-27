# How to Deploy a Vite App to GitHub Pages

Here is the step-by-step logic to deploy your Vite application to GitHub Pages from scratch.

## 1. Initialize Git Repository
First, you need to turn your project folder into a Git repository and link it to GitHub.

```bash
# Initialize git in your project folder
git init

# Link it to your empty GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

## 2. Configure Vite for Relative Paths
By default, Vite assumes your app is hosted at the root domain (`/`). GitHub Pages often hosts at a subpath (e.g., `username.github.io/repo-name/`).

To fix this, we set the `base` path to `./` (relative), so assets load correctly regardless of the URL.

**File:** `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // <--- ADD THIS LINE
})
```

## 3. Create Deployment Workflow
Instead of manually building and uploading files, we use **GitHub Actions** to do it automatically every time you push code.

Create a file at: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ] # Trigger on push to main branch

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Project
        run: npm run build

      - name: Upload Build Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist' # Vite builds to 'dist' folder by default

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

## 4. Push to GitHub
Now, save everything and push it to GitHub.

```bash
git add .
git commit -m "Setup deployment"
git push -u origin main
```

## 5. Enable GitHub Pages
1.  Go to your repository on GitHub.
2.  Click **Settings** > **Pages**.
3.  Under **Build and deployment**, ensure **Source** is set to **GitHub Actions**.

That's it! GitHub will now automatically build and deploy your site whenever you push changes.
