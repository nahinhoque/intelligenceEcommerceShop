# Full deployment walkthrough (Render recommended)

## Which host should I choose?

Use **one Render Web Service** for this repository. The Express app serves:

- The customer storefront at `/`
- The super-admin app at `/super-admin/`
- The API at `/api/v1/`

Both frontends call relative `/api/v1` URLs, and Express serves the production frontend builds. This means the app, APIs, login cookies, images, and payment callbacks share one origin.

Vercel is not the recommended first deployment for the current code. Deploying the frontends separately there would also require hosting the Express API elsewhere and changing API origins, credentialed CORS, cookie behavior, frontend base paths, and payment redirects. Choose Vercel only if you are prepared to make and test that split-host setup.

## What you need

Create or have access to:

1. A GitHub account and a GitHub repository containing this project.
2. A Render account.
3. A MongoDB Atlas database.
4. A Cloudinary account for persistent product images.
5. An SSLCommerz **sandbox** merchant account for testing.

Do not use live payment credentials until all sandbox checks below pass. Never commit `.env`, provider secrets, database passwords, or JWT secrets.

## 1. Prepare and push the project to GitHub

From the project root in PowerShell, check that the project files and lockfiles are present:

```powershell
node --version
Test-Path package-lock.json
Test-Path client\ecommerce\package-lock.json
Test-Path client\super-admin\package-lock.json
```

Use Node.js **20.19.0 or newer** (Mongoose 9 and Vite 7 require a recent Node release). All three `Test-Path` checks should return `True`. The deployment build uses `npm ci`; keep these lockfiles in Git.

If this project is not yet in GitHub:

1. Create a private GitHub repository.
2. Open PowerShell in the project root.
3. Initialize Git if this folder is not already a repository, then add the GitHub remote and push the project. Use the repository URL GitHub provides.
4. Confirm `.env` is not staged or pushed. The root `.gitignore` excludes `.env` files, and the frontend `dist` folders are generated during deployment.

If you already use Git:

```powershell
git status
git add .
git commit -m "Prepare production deployment"
git push
```

Review `git status` before committing. Do not force-push or add environment files.

## 2. Create MongoDB Atlas

1. In Atlas, create a project and a cluster. Atlas clusters use a replica set, which this app needs for transactional stock reservations.
2. Create a **database user** for the app. Give it read/write access to the application database, use a unique strong password, and URL-encode special characters if you construct the connection string yourself.
3. In **Network Access**, allow connections from your Render service. Prefer Render's documented outbound IP ranges or a static outbound IP option if available. Avoid opening Atlas to all IPs for production. If you temporarily use `0.0.0.0/0` for a test deployment, protect it with a strong database user and tighten access afterward.
4. In Atlas, choose **Connect → Drivers**, copy the Node.js connection string, replace the password placeholder, and choose a database name, for example `intelligEcommerce`.
5. Keep the final URI private. You will set it in Render as `MONGODB_URI`; do not commit it.

## 3. Set up persistent product-image storage

1. In Cloudinary, find the cloud name and create/get an API key and API secret.
2. Keep the secret private. You will add the three values to Render:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. **If this is an existing database with uploaded images:** back up the database first. From a machine that has the original `uploads\` files, set a local `.env` with the production `MONGODB_URI` and Cloudinary credentials, then run this once from the project root:

   ```powershell
   npm ci
   npm run uploads:migrate
   ```

   The script uploads existing local files and updates their MongoDB records. Confirm existing images display from Cloudinary before archiving/removing local copies. Do not run this if the database is new and has no old upload records.

New admin uploads go directly to Cloudinary; Render's local filesystem is not used as permanent image storage.

## 4. Create the Render Web Service

1. In Render, choose **New → Web Service** and connect the GitHub repository.
2. Select the branch you want to deploy (usually `main`).
3. Set **Root Directory** to the repository root (leave it blank if Render defaults to the repo root).
4. Select the **Node** runtime and ensure the service uses Node.js 20.19.0 or newer (Node 22 LTS or newer is suitable).
5. Use this **Build Command** exactly:

   ```text
   npm ci && npm --prefix client/ecommerce ci && npm --prefix client/super-admin ci && npm --prefix client/ecommerce run build && npm --prefix client/super-admin run build
   ```

6. Use this **Start Command**:

   ```text
   npm start
   ```

7. Choose a Render region near your Atlas cluster. For reliable checkout and IPN processing, choose an always-on instance plan; free instances may sleep and delay the first request or payment notification.
8. Create the service. Render will build both frontends, start `index.js`, and provide an HTTPS URL such as `https://your-service.onrender.com`.

Do not deploy the two `client` folders as independent Render services for this setup. Express expects their build output under the repository root.

## 5. Add environment variables in Render

Open the Render service's **Environment** settings. Add variables individually; do not paste a `.env` file containing real secrets into GitHub.

### Application and database

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | The private Atlas Node.js connection string |
| `JWT_KEY` | A new, long, random secret; do not reuse a sample or commit it |
| `JWT_Expire_Time` | `1d` (or your chosen token lifetime) |
| `Cookie_Expire_Time` | `86400000` (milliseconds; one day) |
| `PAYMENT_RESERVATION_TTL_MINUTES` | `30` (integer from 5 through 1440) |
| `NODE_ENV` | `production` |

Generate a fresh `JWT_KEY` in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value directly into Render's environment settings; do not commit it or share it.

Render supplies `PORT`; do not hardcode a production port. For this single-origin deployment, leave `CORS_ORIGIN` empty. The app enables CORS only when a separate origin is explicitly configured.

### Cloudinary

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using the values from Cloudinary.

### SSLCommerz sandbox

First deploy can run without payment credentials, but checkout will return a configuration error until they are added. To enable sandbox checkout, set:

| Variable | Sandbox value |
| --- | --- |
| `SSLCZ_STORE_ID` | Your SSLCommerz sandbox store ID |
| `SSLCZ_STORE_PASSWD` | Your SSLCommerz sandbox store password |
| `SSLCZ_CURRENCY` | `BDT` unless your merchant setup uses another supported currency |
| `SSLCZ_INIT_URL` | `https://sandbox.sslcommerz.com/gwprocess/v4/api.php` |
| `SSLCZ_VALIDATION_URL` | `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php` |
| `SSLCZ_SUCCESS_URL` | `https://YOUR-SERVICE.onrender.com/api/v1/payment-success` |
| `SSLCZ_FAIL_URL` | `https://YOUR-SERVICE.onrender.com/api/v1/payment-fail` |
| `SSLCZ_CANCEL_URL` | `https://YOUR-SERVICE.onrender.com/api/v1/payment-cancel` |
| `SSLCZ_IPN_URL` | `https://YOUR-SERVICE.onrender.com/api/v1/payment-ipn` |
| `PAYMENT_SUCCESS_URL` | `https://YOUR-SERVICE.onrender.com/cart-thank-you` |
| `PAYMENT_FAIL_URL` | `https://YOUR-SERVICE.onrender.com/payment-fail` |
| `PAYMENT_CANCEL_URL` | `https://YOUR-SERVICE.onrender.com/payment-cancel` |

Replace `YOUR-SERVICE` with the actual Render hostname, without angle brackets. The backend appends the transaction ID to each `SSLCZ_*_URL`, so do **not** add `/:trx_id` yourself.

Save the variables and trigger a redeploy if Render does not deploy automatically.

## 6. Create the first admin account

`/api/v1/admin-register` is protected and should stay protected. Create the initial admin using the interactive script from a trusted machine:

1. In the project root, create a local `.env` from `.env.example` only if you do not already have one, then set its `MONGODB_URI` to the Atlas database used by Render:

   ```powershell
   if (!(Test-Path .env)) { Copy-Item .env.example .env }
   notepad .env
   ```

2. Run:

   ```powershell
   npm ci
   npm run admin:create
   ```

3. Enter the admin email and a strong password of at least 12 characters when prompted. Password input is hidden. The script refuses to create another admin once one exists.
4. Remove the production database URI and other production secrets from the local `.env` when finished. Do not share that file.

If an admin already exists, skip this step and use that account. The application has no seed script; after login, add categories, brands, products, and product images through the super-admin dashboard.

## 7. Configure SSLCommerz IPN

In the SSLCommerz merchant/sandbox panel, configure the IPN listener to the base endpoint without a transaction ID:

```text
https://YOUR-SERVICE.onrender.com/api/v1/payment-ipn
```

Set `SSLCZ_IPN_URL` to that same base URL. During checkout the app also appends the transaction ID to the IPN URL it sends to SSLCommerz; both the base path and transaction-specific path are supported. Confirm the panel can reach the public HTTPS Render service. The app verifies the IPN signature and separately validates successful transactions against SSLCommerz before marking invoices paid.

## 8. Verify the deployment

After Render reports the deploy is live, open:

1. `https://YOUR-SERVICE.onrender.com/` — customer storefront.
2. `https://YOUR-SERVICE.onrender.com/super-admin/` — super-admin login.
3. `https://YOUR-SERVICE.onrender.com/api/v1/all-categories/10/1` — public category API response. An empty category list is expected until you add catalog data.

Then:

1. Sign in to `/super-admin/` with the initial admin.
2. Add a category and brand, upload a product image, and create a product with stock.
3. Open the customer storefront, confirm products and images load, register a customer, and complete the customer profile/shipping fields.
4. Test login/logout for both customer and admin. Render HTTPS is required for the secure cross-site cookie attributes used by the app.
5. Test a sandbox checkout success. Confirm the invoice becomes `success` only after SSLCommerz validation and that the unchanged cart items are removed.
6. Test sandbox failure and cancellation. Confirm the cart remains and stock is restored. Unsigned/invalid failure callbacks do not alter payment state; their reservations are released by a signed IPN or by expiry.
7. Abandon a checkout and verify its stock reservation expires after the configured TTL.
8. Confirm image upload, display, and removal in the admin dashboard.
9. In Render, inspect **Logs** for startup, Atlas, Cloudinary, and callback errors. In Atlas, confirm the application is connecting to the expected database.

There is no dedicated `/health` endpoint; the category API URL above is a useful database-backed smoke check.

## 9. Optional custom domain

1. Add your domain in the Render service's **Custom Domains** settings.
2. Add the DNS records Render provides at your domain registrar and wait for Render's TLS certificate.
3. Choose one canonical HTTPS hostname.
4. Change all `SSLCZ_*_URL` and `PAYMENT_*_URL` values to that hostname.
5. Update the SSLCommerz merchant-panel IPN URL to match.
6. Redeploy and repeat the customer/admin login and payment callback tests.

## 10. Before switching to live payments

Do not change the app to live mode until sandbox success, fail, cancel, IPN signature, inventory expiry, and image-storage checks all pass.

For live mode, use the live store ID/password from SSLCommerz and change only the provider endpoints:

```text
SSLCZ_INIT_URL=https://securepay.sslcommerz.com/gwprocess/v4/api.php
SSLCZ_VALIDATION_URL=https://securepay.sslcommerz.com/validator/api/validationserverAPI.php
```

Keep the callback URLs on your canonical HTTPS host and update the live SSLCommerz merchant-panel IPN setting. Start with a low-value real transaction and confirm the provider dashboard, invoice, customer order history, and any refund process before opening the store to customers.

If inventory is unavailable after a valid late payment, the invoice is marked `refund_required`; this project does not automatically issue a refund. An operator must arrange and record the refund and contact the customer.

## Troubleshooting

- **Render build fails:** confirm all three `package-lock.json` files are pushed and the build command is exactly as shown.
- **Unsupported Node/runtime error:** set the Render Node version to 20.19.0 or newer, then redeploy.
- **Render exits during startup / Atlas connection error:** check `MONGODB_URI`, database username/password encoding, Atlas network access list, and Render logs.
- **Login cookie does not persist:** use the HTTPS Render URL (not an HTTP/local URL), then test in a fresh browser session.
- **`Payment provider configuration is incomplete`:** set every `SSLCZ_*` variable, including the validation URL and all callback URLs, then redeploy.
- **Payment starts but is not confirmed:** keep the gateway in sandbox, inspect Render logs and SSLCommerz sandbox/IPN settings, and do not manually mark the invoice paid.
- **Product images are missing:** verify Cloudinary credentials and migrate legacy local uploads. Render local files are not durable.
- **Admin cannot sign in:** verify the account exists in the same Atlas database used by Render; use `npm run admin:create` only when there are no admin accounts.

## Provider documentation

- [Official SSLCommerz API documentation](https://developer.sslcommerz.com/doc/v4/)
- [Cloudinary Node.js upload documentation](https://cloudinary.com/documentation/node_image_and_video_upload)
