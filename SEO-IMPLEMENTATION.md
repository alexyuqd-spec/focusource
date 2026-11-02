# FOCUSOURCE SEO 与销售内容实施记录

日期：2026-10-23。目标：全球英文采购市场；同时自然使用 strap / strapping。

## 本批已完成，待服务器发布

- 首页 SEO 标题、描述与五个核心产品页的标题和描述优化。通过字段级补丁更新；若线上字段已被另行编辑，保留自定义值并输出提示。
- 新增 `/guides/` 导览及四篇原创英文文章，包含独立标题、描述、canonical、Article 标记、产品链接和询价入口。
- 首页增加可抓取的指南链接，网站地图增加五个指南网址。
- 复合打包带页面增加 flat polyester yarn / twisted polyester yarn 实拍、穿扣图、收卷视频、四种宽度系统测试视频。
- 钢丝扣与手动工具产品页增加配套照片和操作指南入口。
- 19 张用户原图转为网页 WebP 副本，保留原文件；已生成 5 个 H.264 网页视频副本和封面。原视频未修改；网页副本去掉现场音轨，横置画面已转正。

## 关键词与页面分工

下表是按产品和采购意图制定的关键词分组，不包含付费工具搜索量或竞争难度测量，也不代表排名承诺。

| 页面 | 主要意图 | 关键词方向 |
| --- | --- | --- |
| 首页 | 供应商与完整配套 | composite strapping manufacturer; composite strap supplier |
| `/products/composite-cord-strapping` | 规格与询价 | composite cord strapping; polyester composite strap; 16 mm / 19 mm / 25 mm / 32 mm composite strap |
| `/products/wire-buckles` | 配套扣具 | wire buckles for composite strap; strapping wire buckle |
| `/products/hotmelt-strapping` | 热熔带采购 | hotmelt polyester strapping; hotmelt strap |
| `/products/woven-lashing` | 编织带采购 | woven polyester lashing; woven lashing strap |
| `/products/lashing-buckles` | 捆绑扣采购 | lashing buckles; buckles for woven polyester strap |
| `/guides/composite-strapping-vs-steel-strapping` | 材料比较 | composite strapping vs steel strapping |
| `/guides/choose-composite-strap-width-and-strength` | 型号选择 | composite strap width; composite strapping system strength |
| `/guides/how-to-thread-wire-buckle-composite-strap` | 操作学习 | how to thread a wire buckle; composite strap tensioner |
| `/guides/composite-strapping-vs-hotmelt-strapping` | 结构比较 | composite strapping vs hotmelt strapping |

## 用户确认的型号对应关系

| 宽度 | 打包带 | 扣具 | 网页视频来源文件 |
| --- | --- | --- | --- |
| 16 mm | CS50 | WB16 | `69294a0cc006c1f4a87e8a22853ac808.mp4` |
| 19 mm | CS60 | WB19 | `f6c641e8e4f848ac299e68b201cc969f.mp4` |
| 25 mm | CS85 | WB25 | `915af69cfe190d3ac322e85afaa1ea2a.mp4` |
| 32 mm | CS105 | WB32 | `a3f354a93062554d3d7fd84a6f77c5ba.mp4` |

所有测试按用户确认标为系统测试。未把屏幕读数当作保证值，未生成新的强度、认证、工作载荷或检测报告。

文章以现有产品资料、用户照片和视频原创编写，不复制供应商文字、图片或版式。flat / twisted yarn 两张图片与组合展示图均来自用户提供的 DSC_7186、DSC_7187、DSC_7219。

## 发布与后续

统一更新包：`release/focusource-seo-content-20261023.tar.gz`。发布前备份被修改的代码和 SEO 数据字段。询盘、上传文件、联系方式、密钥、Nginx 和证书配置保持原有内容。启动检查失败自动回退。

这批指南正文在 `seo-guides.js` 中维护，后台现有 Insights 卡片不作为这四篇的正文编辑器。指南新增在首页底部的 Buying guides 区域，有独立导航页和站点地图链接。

发布后先验证公网指南、图片和视频，再在 Search Console 检查新文章，必要时请求编入索引。网站地图已提交，不用反复提交。记录非品牌查询的展示、点击、页面、国家和询盘，等有足够数据再调整。

## 仍需真实业务资料的工作

- 工厂信息：可公开的公司主体、生产地址、实际设备/产能、可验证的证书及检测记录，确认后再补充公司与质量页面。
- 客户案例：需要可公开的实际货物、使用型号、场景和授权照片；不生成虚构客户评价。
- 行业曝光与外链：筛选真实合作伙伴、客户、展会和行业组织，准备具体介绍后再联系；本批没有向外部发送消息或购买链接。
- 长期排名：根据 Search Console 数据持续优化，不能靠重复提交或批量同义词页面保证排名。

## 2026-10-24 product photography and catalogue revision (prepared, awaiting deployment)
New original images: four tensioners, wire buckle range, orange woven lashing roll and weave detail. Tensioner models and applicable widths confirmed by owner: green T19 19mm, red T25 25mm, orange T32 32mm, blue T50 50mm. Confirmed CS40/WB13 pairing added without claiming a corresponding video. Additional original application photos distinguish container interior from vessel cargo hold. Product titles/descriptions, alt text, social images and WebPage image data updated. Existing product canonicals unchanged. PDF remains 12 pages and uses same download URL. Combined guarded package: focusource-product-catalogue-update-20261024.tar.gz. Previous application update included, so only this latest package is needed. Website 206 checks passed; desktop/mobile and PDF visual checks recorded in release/.
