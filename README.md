# Intellig E-commerce

An e-commerce application with a customer storefront, a protected administration dashboard, and a REST API. The Node.js/Express server connects to MongoDB, stores product images in Cloudinary, and integrates with SSLCommerz for checkout and payment notifications.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Application layout](#application-layout)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Tests](#tests)
- [Deployment](#deployment)
- [Security and operations](#security-and-operations)

## Features

### Customer storefront

- Browse, search, and filter products by category, brand, remark, and keyword.
- View product details, categories, brands, and product reviews.
- Register, sign in/out, and manage a customer profile.
- Manage a cart and submit an order with customer and shipping details.
- Pay through SSLCommerz and view payment results and order history.
- Submit and update product reviews.

### Administration dashboard

- Protected admin sign-in and profile management.
- Dashboard summary and catalog management for products, categories, and brands.
- Review, order, and invoice management, including CSV order export.
- Upload and manage product and catalog images.

### Backend and integrations

- REST API with separate customer and admin authentication.
- MongoDB persistence through Mongoose.
- Cloudinary image storage for durable uploads.
- SSLCommerz payment callbacks and IPN handling. Successful payments are validated with SSLCommerz before invoices are marked as paid.
- Transactional inventory reservation during checkout, with expiry and stock release for failed, cancelled, or expired payments.
- Security middleware, input sanitization, and rate limiting on authentication endpoints.

## Technology

- **Backend:** Node.js, Express 5, Mongoose, MongoDB
- **Customer and admin UIs:** React 19, Vite 7
- **Authentication:** JWT and HTTP cookies
- **Image storage:** Cloudinary
- **Payments:** SSLCommerz
- **Testing:** Node.js built-in test runner

## Application layout

```text
.
├── app.js                         # Express middleware, API and static frontend routes
├── index.js                       # MongoDB connection and server startup
├── src/
│   ├── config/                    # Database and Cloudinary setup
│   ├── controllers/               # API request handlers
│   ├── middlewares/               # Authentication and upload middleware
│   ├── models/                    # Mongoose schemas
│   ├── routes/api.js              # REST API routes
│   └── services/                  # Payment and inventory lifecycle services
├── client/
│   ├── ecommerce/                 # Customer React/Vite application
│   └── super-admin/               # Admin React/Vite application
├── scripts/                       # Initial admin and image migration utilities
├── test/                          # Backend unit tests
├── .env.example                   # Environment variable names and safe defaults
└── DEPLOYMENT.md                  # Detailed Render deployment walkthrough
```

In production, Express serves the customer storefront at `/`, the admin dashboard at `/super-admin/`, and the API under `/api/v1/`. Both frontends use relative API URLs, so the recommended setup keeps them on the same origin as the backend.

## Requirements

- Node.js **20.19.0 or newer**
- npm
- MongoDB connection string (Atlas or a local replica-set deployment; transactions are used for inventory/payment flows)
- Cloudinary credentials for image upload functionality
- SSLCommerz sandbox credentials for checkout testing

## Local development

### 1. Install dependencies

Run these commands from the repository root:

```powershell
npm ci
npm --prefix client/ecommerce ci
npm --prefix client/super-admin ci
```

### 2. Configure environment variables

Create a local `.env` from the example and edit it with your own development credentials:

```powershell
Copy-Item .env.example .env
```

Set at least `MONGODB_URI` and `JWT_KEY` before starting the API. Configure Cloudinary and SSLCommerz when you need image uploads or checkout. See [Environment variables](#environment-variables).

### 3. Start the API and frontends

Start each process in a separate terminal, from the repository root:

```powershell
npm run dev
```

```powershell
npm --prefix client/ecommerce run dev
```

```powershell
npm --prefix client/super-admin run dev
```

The API listens on port `3000` by default. The customer Vite app uses its default port (normally `5173`); the admin app uses port `3001`. Both Vite development servers proxy `/api/` requests to `http://localhost:3000`.

- Customer storefront: `http://localhost:5173/`
- Admin dashboard: `http://localhost:3001/super-admin/`
- API base path: `http://localhost:3000/api/v1/`

The first admin account is bootstrapped separately; see [Create the initial admin](#create-the-initial-admin).

### Build the frontends

```powershell
npm --prefix client/ecommerce run build
npm --prefix client/super-admin run build
```

The generated files are placed in each frontend's `dist/` folder. Express serves these builds when running the application in production.

### Create the initial admin

Set `MONGODB_URI` in your local `.env` to the database the application should use, then run this interactively from the repository root:

```powershell
npm run admin:create
```

The script prompts for an email and a password of at least 12 characters (the password is hidden while typing). It only creates an admin if the database does not already contain one. Run it only from a trusted machine and verify that `MONGODB_URI` points to the intended database.

## Environment variables

Use `.env.example` as the authoritative list of supported variables. Keep real values in a local, ignored `.env` or your hosting provider's secret/environment settings; never commit them.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. Use a replica set for transactional payment and stock operations. |
| `JWT_KEY` | Private signing secret for authentication tokens. Use a long, unique random value. |
| `JWT_Expire_Time` | JWT lifetime, for example `1d`. |
| `Cookie_Expire_Time` | Cookie lifetime in milliseconds, for example `86400000` for one day. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Private Cloudinary API secret. |
| `SSLCZ_STORE_ID` | SSLCommerz merchant/store ID. |
| `SSLCZ_STORE_PASSWD` | Private SSLCommerz store password. |
| `SSLCZ_CURRENCY` | Payment currency; the example uses `BDT`. |
| `SSLCZ_INIT_URL` | SSLCommerz payment initialization endpoint. Use the sandbox endpoint for testing. |
| `SSLCZ_VALIDATION_URL` | SSLCommerz transaction validation endpoint. Must use HTTPS. |
| `SSLCZ_SUCCESS_URL` | Public API callback URL for successful checkout. |
| `SSLCZ_FAIL_URL` | Public API callback URL for failed checkout. |
| `SSLCZ_CANCEL_URL` | Public API callback URL for cancelled checkout. |
| `SSLCZ_IPN_URL` | Public API endpoint for SSLCommerz IPN notifications. |
| `PAYMENT_SUCCESS_URL` | Storefront destination after successful payment. |
| `PAYMENT_FAIL_URL` | Storefront destination after failed payment. |
| `PAYMENT_CANCEL_URL` | Storefront destination after cancelled payment. |
| `PAYMENT_RESERVATION_TTL_MINUTES` | Pending stock reservation lifetime; an integer from 5 to 1440. Defaults to 30 minutes. |
| `CORS_ORIGIN` | Optional comma-separated list of exact frontend origins when the UI is hosted separately. Leave empty for the recommended single-origin deployment. |
| `PORT` | HTTP port. Defaults to `3000` locally; hosting platforms typically provide this automatically. |
| `NODE_ENV` | Set to `production` in production deployments. |

For production, set callback URLs to the deployed HTTPS hostname, without adding a transaction ID path segment; the application appends transaction IDs where needed. Keep the SSLCommerz IPN endpoint publicly reachable. Never use live payment credentials for sandbox testing.

## API overview

All API routes are prefixed with `/api/v1`. Authentication uses cookies; protected routes require the corresponding customer or admin session.

| Area | Route patterns | Access |
| --- | --- | --- |
| Admin authentication/profile | `/admin-register`, `/admin-login`, `/admin`, `/admin-verify`, `/admin-logout`, `/admin-update` | Admin registration is protected; login is public; profile routes require admin authentication |
| Customer authentication/profile | `/user-register`, `/user-login`, `/user`, `/user-verify`, `/user-logout`, `/user-update` | Login and registration are public; profile routes require customer authentication |
| Products | `/all-products/:category_id/:brand_id/:remark/:keyword/:per_page/:page_no`, `/single-product/:id`, `/create-product`, `/update-product/:id`, `/delete-product/:id` | Reads are public; writes require admin authentication |
| Categories | `/all-categories/:per_page/:page_no`, `/single-category/:id`, `/create-category`, `/update-category/:id`, `/delete-category/:id` | Reads are public; writes require admin authentication |
| Brands | `/all-brand/:per_page/:page_no`, `/single-brand/:id`, `/create-brand`, `/update-brand/:id`, `/delete-brand/:id` | Reads are public; writes require admin authentication |
| Reviews | `/all-review/:per_page/:page_no`, `/all-review-by-product/:product_id`, `/create-review`, `/update-review/:id` | Product reviews are public; review creation/update requires customer authentication; all-review listing requires admin authentication |
| Cart | `/create-cart`, `/read-cart`, `/update-cart/:cart_id`, `/delete-cart/:cart_id` | Customer authentication |
| Customer orders | `/create-invoice`, `/read-all-invoice-single-user/:page_no/:per_page`, `/read-single-invoice-single-user/:invoice_id`, `/read-invoice-product-list-single-user/:page_no/:per_page` | Customer authentication |
| Payment callbacks | `/payment-success/:trx_id`, `/payment-fail/:trx_id`, `/payment-cancel/:trx_id`, `/payment-ipn`, `/payment-ipn/:trx_id` | Called by the payment provider; payment state is validated server-side |
| Admin orders | `/all-order-list/:page_no/:per_page`, `/export-csv`, `/update-invoice` | Admin authentication |
| File management | `/file-upload`, `/all-file/:page_no/:per_page`, `/file-remove`, `/get-file/:filename` | Upload/list/remove require admin authentication; file retrieval is public |
| Dashboard | `/dashboard-summary` | Admin authentication |

The complete route and middleware definitions are in [`src/routes/api.js`](src/routes/api.js).

## Tests

Run the backend tests with:

```powershell
npm test
```

The test suite uses Node.js's built-in test runner and covers token helpers, SSLCommerz payment verification, and payment/inventory lifecycle behavior.

Frontend scripts:

```powershell
npm --prefix client/ecommerce run lint
npm --prefix client/ecommerce run build
npm --prefix client/super-admin run lint
npm --prefix client/super-admin run build
```

## Deployment

The recommended deployment is one Render Web Service serving the API and both built frontends from the same origin. The full guide covers MongoDB Atlas networking, Cloudinary, environment configuration, SSLCommerz callbacks/IPN, initial admin creation, smoke checks, custom domains, and production payment readiness:

**[Read the full deployment walkthrough](DEPLOYMENT.md).**

The Render build command is:

```text
npm ci && npm --prefix client/ecommerce ci && npm --prefix client/super-admin ci && npm --prefix client/ecommerce run build && npm --prefix client/super-admin run build
```

The start command is:

```text
npm start
```

Do not host the two frontends as standalone static sites without also configuring a separate backend origin, credentialed CORS, cookies, frontend API URLs, and payment callback URLs.

## Security and operations

- Never commit `.env`, database credentials, JWT secrets, or provider secrets. The repository ignores `.env` files; `.env.example` contains placeholders.
- If a secret has been included in a screenshot, pasted into chat, or committed, rotate/revoke it with its provider. Replacing a JWT signing secret invalidates existing tokens.
- Use separate, least-privilege credentials for production services and restrict MongoDB network access.
- Use HTTPS for production, especially for authentication cookies and payment callbacks.
- Keep SSLCommerz in sandbox until success, failure, cancellation, IPN, stock-reservation expiry, and image-storage flows have been verified.
- Cloudinary is the persistent image store. Do not rely on a hosting provider's local filesystem for permanent user uploads.
- Existing local uploads can be migrated with `npm run uploads:migrate`; back up the database first and follow the migration procedure in [DEPLOYMENT.md](DEPLOYMENT.md).
- A valid late payment may require manual refund handling if inventory is unavailable. The application marks the invoice `refund_required`; it does not automatically issue a refund.
- The application does not currently expose a dedicated health endpoint. The public categories endpoint can be used as a basic database-backed deployment check: `/api/v1/all-categories/10/1`.
