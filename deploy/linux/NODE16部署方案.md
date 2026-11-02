# 当前服务器的 Node 16 兼容升级

已确认环境：CentOS 7、Node **16.20.2**（`/usr/bin/node`）、systemd **219**，网站位于 `/var/www/focusource`，由 `focusource.service` + 现有 Nginx 运行。

此次方案保留当前服务器和 Node 版本。代码已改用 Node 内置 HTTP/HTTPS 请求，询盘邮件和验收不再依赖 Node 18 的全局 fetch；升级脚本支持 systemd 219、旧版 curl，自动选取旧系统适用的服务配置。无需执行 npm install。

Node 16 和 CentOS 7 均已停止官方安全维护。适配解决运行兼容性，并不会让旧运行环境恢复安全维护。当前保留原有 root 服务账户，降低服务权限仍需单独安排。

## 升级前准备

1. 在腾讯云控制台创建当前实例快照，确认成功。这份快照用于保留操作系统、宝塔、Nginx、证书和其他配置。
2. 只使用新包 `focusource-node16-upgrade-20261021.tar.gz`，旧版 v1/v2 包仍要求新版 Node，不能在此服务器执行。
3. 将新包上传到服务器 `/tmp/`。不要把备份、环境文件或密钥放入网站公开目录。
4. 检查 `/etc/focusource.env` 的 `ADMIN_PASSWORD` 是独立设置的至少 16 位强密码。若要修改，用宝塔文件编辑器编辑并保留其他原有配置；不要把密码发到聊天，也不要用示例文件覆盖现有文件。

环境值应为：`HOST=127.0.0.1`、`PORT=4173`、`NODE_ENV=production`、`TRUST_PROXY=1`。此包不安装 Node，不调整 Nginx、证书或防火墙。

## 先做只读预检

在同一个服务器终端逐行执行：

```bash
NODE16_UPGRADE_DIR=$(mktemp -d /tmp/focusource-node16-XXXXXX)
tar -xzf /tmp/focusource-node16-upgrade-20261021.tar.gz -C "$NODE16_UPGRADE_DIR"
sudo bash "$NODE16_UPGRADE_DIR/focusource-node16-upgrade-20261021/deploy/linux/upgrade-launch.sh" --check
```

看到 `Preflight passed` 后才能继续。预检检查目录、Node 版本、服务账户、服务文件位置和管理员密码等，不停止网站、不备份、不写入网站文件。若有服务 drop-in 或自定义服务文件，预检会停止，需要核对实际配置。最低 Node 版本限定为已确认的 16.20.2。

## 安装升级

安装会短暂停站，请安排业务低峰期。在刚才同一个终端执行：

```bash
sudo bash "$NODE16_UPGRADE_DIR/focusource-node16-upgrade-20261021/deploy/linux/upgrade-launch.sh"
```

脚本停止网站后，先备份线上真实内容、询盘、上传文件、环境文件及旧代码和服务文件，再安装升级并检查 `/healthz`。新包不包含本地 data、上传媒体、LOGO 或密钥，不会以本地数据替换线上数据；仅清除不符合格式的 Google Ads ID。

遇到安装错误会尝试恢复已备份的旧代码和服务并重新启动，不能保证所有故障都能自动恢复。回滚保留当前数据和上传文件；未回滚每日备份定时器或被清除的无效 Ads ID。请保存终端显示的备份路径。完整快照恢复会覆盖快照后的服务器变化，不能随意覆盖新增询盘。

## 检查结果

```bash
sudo systemctl is-active focusource
curl --fail http://127.0.0.1:4173/healthz
sudo systemctl is-enabled focusource
sudo systemctl list-timers focusource-backup.timer --all
sudo journalctl -u focusource -n 30 --no-pager
```

然后检查 [网站](https://www.composite-strapping.com/) 和 [后台](https://www.composite-strapping.com/admin.html)，提交一条标注“上线测试”的询盘并核对后台记录。

只读页面审计：

```bash
cd /var/www/focusource
BASE_URL=https://www.composite-strapping.com AUDIT_REPORT=/tmp/focusource-audit.json /usr/bin/node scripts/audit-site.js
```

如服务器不能请求公网域名，可使用 `BASE_URL=http://127.0.0.1:4173` 检查应用，但这不能验证外网、Nginx 和 HTTPS。

每日备份为服务器时间 03:15，存放于 `/var/backups/focusource`。手动运行 `sudo /usr/local/sbin/focusource-backup` 可生成一次备份。备份包含密码和客户信息，应保存私有异地副本并检查磁盘空间；脚本不会自动清理旧备份。它不包含完整 Nginx/证书/系统配置，不能取代云快照。

## 后续功能与验证边界

升级后继续按《上线后操作说明》的邮件、Search Console、GA4 和产品页面验收部分操作。邮件需要 Resend 账户、域名验证、API 密钥及服务器到服务商的 HTTPS 连接；代码适配并不等于这些账户已配置完成。

本地 25 项自动测试通过，隔离网站页面审计 151 项通过；覆盖无全局 fetch/AbortSignal 时的实际 HTTP 请求、超时、响应上限及邮件传输，以及模拟旧 systemctl 和失败回滚。本机使用新版 Node 测试，下载 Node 16 测试运行时被自动审批接口错误（404）阻止，未取得真实 Node 16 测试运行时，也未在真实 CentOS 7/systemd 219 上执行安装。服务器预检和安装后的验收仍是必要步骤。尚未执行任何远程升级。
