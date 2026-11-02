from pathlib import Path
import json, math, re, html, io
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT=Path(__file__).resolve().parents[1]
TMP=ROOT/'tmp/pdfs'; TMP.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'output/pdf/FOCUSOURCE-Strapping-Systems-Catalogue.pdf'
site=json.loads((TMP/'catalogue-site.json').read_text(encoding='utf8')); s=site['settings']; products={p['id']:p for p in site['products']+site.get('applications',[])}
W,H=595.276,841.89; M=42; CW=W-2*M
GREEN=HexColor('#183C32'); SAGE=HexColor('#718477'); PAPER=HexColor('#F5F4EE'); INK=HexColor('#1C2923'); MUTED=HexColor('#65746B'); LINE=HexColor('#D7DED6')
pdfmetrics.registerFont(TTFont('Brand','C:/Windows/Fonts/arial.ttf'));pdfmetrics.registerFont(TTFont('BrandBold','C:/Windows/Fonts/arialbd.ttf'))
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1);c.setTitle('FOCUSOURCE | Composite Strap & Strapping Systems');c.setAuthor('FOCUSOURCE');c.setSubject('Product catalogue: composite strap, wire buckles, lashing and tools')
page_no=0

def clean(v):
 return str(v).replace('\u2013','-').replace('\u2014','-').replace('\u2212','-').replace('\u2011','-').replace('\u00d7',' x ').replace('\u00a0',' ')
def p(text,x,top,w=CW,size=10.4,leading=None,color=INK,bold=False):
 st=ParagraphStyle('p',fontName='BrandBold' if bold else 'Brand',fontSize=size,leading=leading or size*1.45,textColor=color,spaceAfter=0)
 obj=Paragraph(clean(text),st);_,h=obj.wrap(w,H);obj.drawOn(c,x,H-top-h);return h

def text(t,x,top,size=10,color=INK,bold=False):
 c.setFillColor(color);c.setFont('BrandBold' if bold else 'Brand',size);c.drawString(x,H-top-size*.82,clean(t))
def rect(x,top,w,h,fill,r=0):
 c.setFillColor(fill);c.setStrokeColor(fill)
 if r:c.roundRect(x,H-top-h,w,h,r,stroke=0,fill=1)
 else:c.rect(x,H-top-h,w,h,stroke=0,fill=1)
def rule(top):c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,H-top,W-M,H-top)
def mark(x,top,size=38,ink=GREEN):
 c.saveState();c.translate(x,H-top-size);c.scale(size/240,size/240);c.setStrokeColor(ink);c.setFillColor(ink);c.setLineCap(0)
 for r,width in [(81,21),(58,17),(35,13)]:
  c.setLineWidth(width);c.arc(120-r,120-r,120+r,120+r,startAng=44,extent=272)
 path=c.beginPath();path.moveTo(171.5,240-168.5);path.lineTo(205,240-135);path.lineTo(174,240-135);path.lineTo(164,240-145);path.close();c.drawPath(path,fill=1,stroke=0);c.restoreState()
def header(section):
 mark(M-5,22,35);text('FOCUSOURCE',M+35,28,13,GREEN,True);text(section.upper(),W-220,32,8.5,MUTED)
 rule(67)
def footer():
 rule(795);text('www.composite-strapping.com',M,808,8,MUTED);text('PRODUCT CATALOGUE / OCT 2026',M+245,808,7.3,MUTED);text(f'{page_no:02}',W-M-12,806,10,GREEN,True)
def new(section,title=None,sub=None,dark=False):
 global page_no
 if page_no:c.showPage()
 page_no+=1;rect(0,0,W,H,GREEN if dark else white)
 if not dark:
  header(section)
  if title:p(title,M,92,CW,26,29,GREEN,True)
  if sub:p(sub,M,158,CW,10.5,15,MUTED)
def image(src,x,top,w,h,fit='contain',bg=PAPER):
 src=Path(src)
 if not src.exists():raise FileNotFoundError(src)
 im=ImageOps.exif_transpose(Image.open(src)).convert('RGB');im.thumbnail((1800,1800))
 if fit=='cover':im=ImageOps.fit(im,(int(w*2.5),int(h*2.5)),method=Image.Resampling.LANCZOS)
 rect(x,top,w,h,bg)
 iw,ih=im.size;scale=min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
 buf=io.BytesIO();im.save(buf,format='JPEG',quality=86,optimize=True);buf.seek(0)
 c.drawImage(ImageReader(buf),x+(w-dw)/2,H-top-h+(h-dh)/2,dw,dh,mask='auto')
def prod(id):return ROOT/'public'/products[id]['image'].lstrip('/')
def guide(name):return ROOT/'public/assets/guides'/name

def table(rows,x,top,widths,size=8.3):
 styles=ParagraphStyle('cell',fontName='Brand',fontSize=size,leading=size*1.3,textColor=INK)
 heads=ParagraphStyle('head',fontName='BrandBold',fontSize=size,leading=size*1.3,textColor=white)
 data=[[Paragraph(html.escape(clean(v)).replace('\n','<br/>'), heads if i==0 else styles) for v in row] for i,row in enumerate(rows)]
 t=Table(data,colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('ROWBACKGROUNDS',(0,1),(-1,-1),[PAPER,white]),('LINEBELOW',(0,0),(-1,0),.5,GREEN),('LINEBELOW',(0,1),(-1,-1),.35,LINE)]));_,h=t.wrap(sum(widths),H);t.drawOn(c,x,H-top-h);return h

def link(label,url,x,top,w=CW):
 h=p(label,x,top,w,9.5,13,GREEN,True);c.linkURL(url,(x,H-top-h,x+w,H-top),relative=0,thickness=0);return h

def qrcode(url,x,top,size=64):
 rect(x-5,top-5,size+10,size+10,white,3)
 widget=qr.QrCodeWidget(url);bounds=widget.getBounds();d=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0]);d.add(widget);renderPDF.draw(d,c,x,H-top-size)
def producturl(id):
 pr=products[id];sl=pr.get('slug') or re.sub('[^a-z0-9]+','-',pr['name'].lower().replace('&',' and ')).strip('-');return s['siteUrl'].rstrip('/')+'/products/'+sl

def facts(id,x,top,w=CW):
 pr=products[id];return p(f"<b>Material:</b> {html.escape(clean(pr['materials']))}<br/><b>Minimum order:</b> {html.escape(pr['moq'])} &nbsp; <b>Typical lead time:</b> {html.escape(pr['leadTime'])}",x,top,w,9,13,MUTED)

# 01 Cover
new('Cover',dark=True)
mark(38,38,68,white);text('FOCUSOURCE',112,62,24,white,True);text('STRAPPING SYSTEMS',114,94,9,HexColor('#B7C7BD'))
p('Composite strap.<br/>Matched systems.',M,168,CW,40,44,white,True)
p('Polyester strapping, wire buckles and application tools',M,275,440,14,20,HexColor('#D7E3D9'))
image(prod('p1'),M,342,CW,300,'cover')
text('STRAP / BUCKLE / TENSIONER',M,679,10,HexColor('#B7C7BD'),True)
p('Product selection and technical specifications<br/>Global supply enquiries | October 2026',M,707,CW,12,19,white)
text('www.composite-strapping.com',M,799,10,white)
c.linkURL(s['siteUrl'],(M,30,W-M,50),relative=0,thickness=0)

# 02 matched system
new('System selection','One system.<br/>Three matched components.','Choose the strap, confirm the buckle, then match the tensioning tool.')
image(guide('composite-strap-wire-buckle-range.webp'),M,205,244,212)
for y,no,title,desc in [(214,'01','Composite strap','Select model, width, construction and system requirement.'),(285,'02','Wire buckle','Confirm the buckle model and finish for the selected strap.'),(356,'03','Manual tensioner','Check supported width, thickness and application method.')]:
 text(no,309,y,12,SAGE,True);p(title,338,y,210,12,16,GREEN,True);p(desc,338,y+22,210,9.4,13,MUTED)
p('Confirmed strap-and-buckle pairings',M,446,CW,17,21,GREEN,True)
h=table([['Width','Composite strap','Wire buckle'],['13 mm','CS40','WB13'],['16 mm','CS50','WB16'],['19 mm','CS60','WB19'],['25 mm','CS85','WB25'],['32 mm','CS105','WB32']],M,484,[100,205,CW-305],10)
p('Pairings confirmed by FOCUSOURCE. Specify buckle finish and the complete model when requesting a quotation. Width alone does not define a system rating.',M,484+h+16,CW,9,13,MUTED)
link('Explore the online buying guides',s['siteUrl']+'/guides/',M,742);footer()

# 03 composite table
new('Composite cord strapping','Composite cord strapping','Polyester yarn reinforcement with a protective polymer coating. Available in flat-yarn and twisted-yarn constructions.')
image(guide('flat-polyester-yarn-composite-strap.webp'),M,204,246,145)
image(guide('twisted-polyester-yarn-composite-strap.webp'),M+264,204,CW-264,145)
text('FLAT POLYESTER YARN',M,361,9,GREEN,True);text('TWISTED POLYESTER YARN',M+264,361,9,GREEN,True)
raw=[r.split('|') for r in products['p1']['specificationTable'].splitlines()]
rows=[['Model','Width\nmm','Thickness\nmm','Yarn','Linear*\ndaN','System*\ndaN','m/coil']]
for r in raw[1:]:rows.append([r[0],r[1].replace('mm',''),r[2].replace('mm',''),r[3].replace(' Yarn',''),r[4].replace(' daN',''),r[5].replace(' daN',''),r[6].replace('m','')])
h=table(rows,M,389,[60,40,78,61,81,81,CW-401],7.8)
p('* Minimum breaking-strength values as listed in the current product specification. Linear and system values are different measurements; neither is an allowable working-load rating. Request the applicable system test record.',M,389+h+13,CW,8.5,12,MUTED)
facts('p1',M,706);link('View composite strap specifications and system-test videos',producturl('p1'),M,757);footer()

# 04 constructions
new('Material selection','Match the construction<br/>to the application.','Compare the specific product and complete system, not only the material name or nominal width.')
p('HOTMELT POLYESTER STRAPPING',M,209,310,15,20,GREEN,True)
image(prod('p11'),M,244,200,160)
p('Polyester yarns bonded with hot-melt adhesive.',265,246,285,12,17,INK,True)
p('Listed widths: 9, 13, 16 and 19 mm.<br/>Colour: white.<br/>Confirm breaking strength and roll length for the selected specification.',265,294,285,10,15,MUTED)
facts('p11',265,357,285)
link('View hotmelt strap options',producturl('p11'),M,421)
rule(455)
p('WOVEN POLYESTER LASHING',M,480,CW,15,20,GREEN,True)
raw=[r.split('|') for r in products['p7']['specificationTable'].splitlines()]
rows=[['Model','Width','Linear*','System*','Packing']]+[[r[0],r[1],r[4],r[5],r[6]]for r in raw[1:]]
image(prod('p7'),M,514,280,98)
image(ROOT/'public/assets/products/woven-lashing-weave-detail.webp',M+298,514,CW-298,98)
h=table(rows,M,626,[73,54,78,78,CW-283],8.0)
p('* Minimum breaking-strength values. Confirm the matched buckle, test method and securing arrangement for your application.',M,626+h+8,CW,8,11,MUTED)
link('View woven lashing and available specifications',producturl('p7'),M,776);footer()

# 05 wire buckles
new('Wire buckles','The joint is part<br/>of the system.','Steel wire buckles for compatible composite strapping. Surface treatment options: electroplating or phosphating.')
image(prod('p2'),M,205,244,180)
image(guide('composite-strap-buckle-tensioner-08.webp'),M+263,205,CW-263,180)
raw=[r.split('|')for r in products['p2']['specificationTable'].splitlines()]
rows=[['Item code','Wire dia.','Packing','Gross wt./box','Box size']]+raw[1:]
h=table(rows,M,413,[81,68,110,91,CW-350],8.2)
p('WB13 / WB16 / WB19 / WB25 / WB32 identify the confirmed width-based pairing families. Specify the full item code above, including wire diameter, and confirm finish for the final order.',M,413+h+13,CW,8.5,12,MUTED)
link('Wire buckle specifications and original threading guide',producturl('p2'),M,756);footer()

# 06 lashing buckle and tools
new('Buckles and tools','Connect it.<br/>Tension it.','Match the buckle, strap construction and application tool before ordering.')
image(prod('p8'),M,203,170,134)
p('Lashing buckles',235,207,310,17,22,GREEN,True)
p('Zinc-plated steel buckles for woven polyester lashing. Available colour options in the specification: silver / yellow.',235,244,310,10,15,MUTED)
facts('p8',235,297,310)
raw=[r.split('|')for r in products['p8']['specificationTable'].splitlines()]
table([['Model','Width','Packing','Net wt./piece','Colour']]+raw[1:],M,363,[82,57,115,105,CW-359],8.5)
rule(525)
image(prod('p3'),M,551,210,125);image(prod('p12'),M+272,551,CW-272,125)
p('Manual tensioning tools',M,690,240,12,16,GREEN,True);p('Heavy-duty ratchet tensioner',M+272,690,240,12,16,GREEN,True)
p('T19 / 19 mm / Green<br/>T25 / 25 mm / Red<br/>T32 / 32 mm / Orange<br/>T50 / 50 mm / Blue',M,714,240,9,13,MUTED)
p('50 mm application width. Confirm strap construction and securing method.',M+272,719,240,9,13,MUTED)
c.linkURL(producturl('p3'),(M,75,M+245,150),thickness=0);c.linkURL(producturl('p12'),(M+272,75,W-M,150),thickness=0);footer()

# 07 tools accessories
new('Packaging equipment','Support the<br/>packing workstation.','Equipment choices for dispensing, tensioning and compatible heat-sealable packaging.')
for id,x,title in [('p9',M,'Mobile strapping dispenser'),('p13',M+272,'Handheld heat sealer')]:
 image(prod(id),x,211,239,228)
 p(title,x,461,239,16,21,GREEN,True)
 if id=='p9':desc='Powder-coated steel trolley.<br/>Listed core options: 200 mm and 400 mm.<br/>Tray for buckles and hand tools.'
 else:desc='Model FKR400.<br/>Sealing length: 400 mm.<br/>Confirm material, thickness, voltage and power before ordering.'
 p(desc,x,520,239,10.5,17,MUTED)
 facts(id,x,615,239)
 link('View product details',producturl(id),x,721,239)
p('Tool and accessory compatibility is confirmed for the selected product specification and application.',M,756,CW,8.7,12,MUTED);footer()

# 08 application photo sequence
new('Application photographs','A closer look<br/>at the complete system.','Original demonstration photographs: composite strap, wire buckle and manual tensioner.')
steps=[('01','Form the strap loop','Prepare a flat loop before threading.'),('04','Seat the first loop','Keep the strap flat around the buckle leg.'),('09','Position the return loop','Follow the selected buckle threading path.'),('08','Remove loose slack','Check both loops are seated.'),('13','Load the tensioner','Use the tool’s specified loading procedure.'),('16','Apply the system','Tension and finish according to the tool instructions.')]
for i,(n,title,desc)in enumerate(steps):
 col=i%2;row=i//2;x=M+col*265;y=203+row*177
 image(guide('composite-strap-buckle-tensioner-'+n+'.webp'),x,y,246,112,'cover')
 p(f'{i+1:02} / {title}',x,y+122,246,10.5,14,GREEN,True)
 p(desc,x,y+141,246,8.7,12,MUTED)
link('Read the full illustrated threading guide',s['siteUrl']+'/guides/how-to-thread-wire-buckle-composite-strap',M,757);footer()

# 09 production and tests
new('Production and system tests','See the process.<br/>Review the evidence.','Watch winding and strap-and-buckle system test demonstrations on our product page.')
image(guide('strap-winding-poster.webp'),M,208,246,153,'cover');image(guide('system-test-32mm-poster.webp'),M+264,208,CW-264,153,'cover')
text('STRAP WINDING',M,375,9,GREEN,True);text('STRAP + BUCKLE SYSTEM TEST',M+264,375,9,GREEN,True)
rows=[['Width','Strap + buckle','Video'],['16 mm','CS50 + WB16','System test demonstration'],['19 mm','CS60 + WB19','System test demonstration'],['25 mm','CS85 + WB25','System test demonstration'],['32 mm','CS105 + WB32','System test demonstration']]
h=table(rows,M,416,[79,166,CW-245],9.3)
p('For performance review, request the sample identity, full buckle specification, test method and corresponding record. Demonstration videos do not establish an allowable working load or a guarantee for every shipment.',M,416+h+16,CW,9,13,MUTED)
qrcode(producturl('p1'),M,684,75);p('Scan to watch',M+97,690,300,15,20,GREEN,True);link('Composite strap production and system-test videos',producturl('p1'),M+97,720,330);footer()

# 10 applications
new('Applications','Start with<br/>your cargo.','Bring us the load details so we can review the appropriate product combination.')
for i,(id,title,desc)in enumerate([('p4','Pallet load securing','Describe the package type, dimensions, mass and handling process.'),('p5','Container load lashing','Share the cargo arrangement, lashing points and transport route.'),('p6','Steel and building materials','Identify sharp edges, surface protection and bundle geometry.')]):
 y=205+i*172;image(prod(id),M,y,211,140,'cover');p(title,277,y+8,275,17,22,GREEN,True);p(desc,277,y+49,275,10.4,16,MUTED)
link('Explore real application photographs',s['siteUrl']+'/applications',M,757);footer()

# 11 additional materials
new('Additional packaging materials','Reflective laminated<br/>packaging film.','V-4110 vacuum metallized polyester film with woven polyethylene reinforcement.')
image(prod('p10'),M,204,CW,236,'cover')
rows=[['Specification','Listed value'],['Item code','V-4110'],['Layer structure','VMPET + PE + PE woven + PE'],['Density','110 g/m²'],['Thickness','120 µm'],['Roll size','2 m x 100 m per roll'],['Net weight','22 kg per roll'],['Packing','Roll + pallet']]
h=table(rows,M,467,[157,CW-157],9.3)
link('Request the complete film specification and test details',producturl('p10'),M,757);footer()

# 12 enquiry
new('Contact',dark=True)
mark(38,38,68,white);text('FOCUSOURCE',112,62,24,white,True);text('STRAPPING SYSTEMS',114,94,9,HexColor('#B7C7BD'))
p('Build your<br/>matched system.',M,174,CW,39,43,white,True)
p('Send the details that help us prepare a useful quotation.',M,285,CW,13,19,HexColor('#CEDCCF'))
rect(M,337,CW,200,HexColor('#254A3D'),10)
for i,line in enumerate(['Product model, width and yarn construction','Required performance and supporting specification','Cargo dimensions, mass and application photographs','Buckle and tensioner models already in use','Coil length, packing, quantity and destination']):
 text(f'{i+1:02}',M+20,360+i*33,10,HexColor('#B7C7BD'),True);p(line,M+54,358+i*33,CW-75,11,16,white)
p(html.escape(s['email']),M,578,CW,19,25,white,True);p('Phone / WhatsApp: '+html.escape(s['phone']),M,616,CW,12,18,white);p(html.escape(s['address']),M,646,CW,12,18,HexColor('#CEDCCF'))
qrcode(s['siteUrl']+'/#enquiry',M,694,79);p('Request a quotation online',M+103,705,360,13,18,white,True);p('www.composite-strapping.com',M+103,735,360,11,16,HexColor('#CEDCCF'))
c.linkURL('mailto:'+s['email'],(M,H-610,W-M,H-570),thickness=0);c.linkURL(s['siteUrl']+'/#enquiry',(M,H-780,W-M,H-690),thickness=0)
p('Specifications reflect the current product listing. Confirm final model, compatibility, packing, lead time and documentation with your quotation.',M,800,CW,7.6,10,HexColor('#B7C7BD'))
c.save();print(json.dumps({'file':str(OUT),'pages':page_no,'bytes':OUT.stat().st_size}))
