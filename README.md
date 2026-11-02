# FOCUSOURCE export packaging website

A lightweight, SEO-ready packaging manufacturer website with a built-in content manager.

## Run locally

Requirements: Node.js 18 or newer.

```powershell
$env:ADMIN_PASSWORD = "use-a-strong-password"
npm start
```

Open:

- Website: `http://127.0.0.1:4173`
- Admin: `http://127.0.0.1:4173/admin.html`

If `ADMIN_PASSWORD` is not set, the local development password is `ChangeMe123!`. Always set a strong environment variable before deployment.

## Content and data

- Site settings, navigation and products: `data/site.json`
- Enquiries: `data/inquiries.json`
- Public assets: `public/`

The admin saves updates through the local API. Uploaded JPG, PNG, WebP and MP4 files are stored in `public/uploads/`, appear in the reusable media library, and have a 5 MB per-file limit.

The content manager covers:

- Logo, company name, tagline, email, phone, WhatsApp and address
- Hero copy and images, proof points and company figures
- Product catalogue and product images
- Navigation menus and automatically generated footer links
- Capabilities, production process and calls to action
- Company introduction, company video, poster image, image ALT text, video SEO fields, certifications and quote
- Insight/article cards and article images
- Enquiry form messaging and incoming enquiry statuses
- SEO metadata, public domain, GA4 and Google Ads conversion tracking

Composite strapping visuals are stored locally in `public/assets/strapping/`. The editable image fields in the admin can replace any of them without changing code.

## Before production

1. Replace the example domain, contact information and product images in the admin.
2. Confirm the production domain in the admin. `robots.txt` and `sitemap.xml` are generated from it automatically.
3. Set `ADMIN_PASSWORD` in the hosting environment.
4. Put the service behind HTTPS and a reverse proxy.
5. Move enquiries and content to a managed database if multiple editors or higher traffic are expected.
6. Configure GA4 and Google Ads conversion IDs in the admin after obtaining consent settings appropriate to target markets.
