# 2026-10-23 SEO 内容更新

适用当前 `/var/www/focusource` + `focusource.service` 部署。

1. 上传 `focusource-seo-content-20261023.tar.gz` 到 `/tmp/`。
2. 执行：

```bash
cd /tmp
tar -xzf focusource-seo-content-20261023.tar.gz
bash /tmp/focusource-seo-content-20261023/publish.sh
```

发布脚本会核对工作目录、检查被替换函数与已审核基线是否一致、备份并更新选定模块。若服务重启或健康检查失败，会恢复本次改动并重新启动旧服务。不会改 Nginx、证书、系统服务配置、密码、询盘或上传文件。

SEO 标题、描述按字段合并：线上自定义值与原始基线不一致时保留，并打印 `Preserved custom SEO field`，不会把本地 site.json 整份覆盖到线上。

如果提示 `Server function differs from reviewed version`，说明线上代码与预期不同；没有开始修改。保留错误输出供核对，不要绕过检查。

成功后检查：

- `https://www.composite-strapping.com/guides/`
- `https://www.composite-strapping.com/products/composite-cord-strapping`
- `https://www.composite-strapping.com/sitemap.xml`

四个系统测试视频通过折叠项按宽度展开，不自动播放；收卷视频独立展示。原文件未修改，网页副本为静音 H.264，避免现场音轨影响浏览。

需要手动回退时，使用成功输出中的备份目录：

```bash
systemctl stop focusource
/usr/bin/node /tmp/focusource-seo-content-20261023/install.js --rollback /var/www/focusource/.seo-backups/替换成实际时间戳
systemctl start focusource
```

回退会恢复本次备份中的 site.json；若发布后已经编辑了后台，先备份最新数据并核对，避免丢失之后的编辑。
