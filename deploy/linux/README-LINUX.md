# FOCUSOURCE Linux deployment

This is the original full-installation guide. For an already deployed website, use `上线后操作说明.md` and the separate launch upgrade package; do not overwrite production data with a full installation archive.

For the confirmed CentOS 7 / Node 16.20.2 / systemd 219 server, use `NODE16部署方案.md` and `focusource-node16-upgrade-20261021.tar.gz`. The older published installation and v1/v2 upgrade archives are not compatible with that environment. Current application code supports Node 16.20.2; the modern service template and commands below target newer operating systems.

This package contains the website, content manager, current content data, and uploaded media.

## Requirements

- Linux server with Node.js 18 or newer
- Nginx (recommended)
- A domain pointed to the server

The application has no third-party npm dependencies, so `npm install` is not required.

## 1. Extract the package

```bash
sudo mkdir -p /var/www/focusource
sudo tar -xzf focusource-linux-20261021.tar.gz -C /var/www/focusource --strip-components=1
sudo chown -R www-data:www-data /var/www/focusource
```

The Node process must be able to write to `data/` and `public/uploads/`, because the admin saves content, enquiries, and uploaded media there.

## 2. Configure the password

```bash
sudo cp /var/www/focusource/deploy/linux/focusource.env.example /etc/focusource.env
sudo nano /etc/focusource.env
sudo chmod 600 /etc/focusource.env
```

Replace the example admin password with a long, unique password.

## 3. Install the systemd service

```bash
sudo cp /var/www/focusource/deploy/linux/focusource.service /etc/systemd/system/focusource.service
sudo systemctl daemon-reload
sudo systemctl enable --now focusource
sudo systemctl status focusource
```

Test the local service:

```bash
curl -I http://127.0.0.1:4173/
```

## 4. Configure Nginx

Edit `deploy/linux/focusource-nginx.conf` and replace `example.com` with the real domain, then install it:

```bash
sudo cp /var/www/focusource/deploy/linux/focusource-nginx.conf /etc/nginx/sites-available/focusource
sudo ln -s /etc/nginx/sites-available/focusource /etc/nginx/sites-enabled/focusource
sudo nginx -t
sudo systemctl reload nginx
```

Configure HTTPS after DNS is active, for example with Certbot.

## Addresses

- Frontend: `https://example.com/`
- Admin: `https://example.com/admin.html`

## Useful commands

```bash
sudo journalctl -u focusource -f
sudo systemctl restart focusource
sudo systemctl stop focusource
```

Before replacing a live installation, back up `data/` and `public/uploads/` because they contain editable production data.
