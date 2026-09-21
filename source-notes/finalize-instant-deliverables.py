"""Build the Instant review PDF from approved repository artwork.

The uploaded Crash presentation supplies the 25-page editorial structure.
Instant artwork, state order and planning estimates come from the Instant site.
Original assets and original Figma exports are never modified.
"""
from pathlib import Path
from io import BytesIO
import argparse, json, re, tempfile, hashlib
from xml.sax.saxutils import escape
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import EmbeddedType1Face, Font
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
import fitz

W,H=1080,607.49292
M=51
CREAM='#F5F0E1'; INK='#142D31'; DARK='#102226'; TEAL='#315F69'; GOLD='#E8B862'; MUTED='#526569'
TITLES=[]
USED=[]

def register_fonts():
    # Use the same Bookman/Nimbus families as the supplied Crash presentation.
    for short,name in [('Title','URWBookman-Demi'),('Body','NimbusSans-Regular'),('Bold','NimbusSans-Bold')]:
        afm=Path('/usr/share/fonts/type1/urw-base35')/(name+'.afm')
        pfb=Path('/usr/share/fonts/X11/Type1')/(name+'.pfb')
        if not pfb.exists():
            from fontTools.t1Lib import T1Font
            pfb=Path(tempfile.gettempdir())/(name+'.pfb')
            T1Font(str(afm.with_suffix('.t1'))).saveAs(str(pfb),'PFB')
        face=EmbeddedType1Face(str(afm),str(pfb));pdfmetrics.registerTypeFace(face)
        pdfmetrics.registerFont(Font(short,face.name,'WinAnsiEncoding'))
    pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
    for family in ['Title','Bold']:pdfmetrics.registerFontFamily(family,normal=family,bold=family,italic=family,boldItalic=family)

class Deck:
    def __init__(self, root, out):
        self.root=root;self.A=root/'assets/instant-final';self.m=json.loads((self.A/'manifest.json').read_text())
        self.out=out;out.parent.mkdir(parents=True,exist_ok=True)
        self.c=canvas.Canvas(str(out),pagesize=(W,H),pageCompression=1,invariant=1)
        self.c.setTitle('Pirate Sea Hop - Instant Game - Art direction and production plan')
        self.c.setAuthor('Norair Harutyunyan')
        self.c.setSubject('25-page Instant game review; approved artwork, all 20 screens, motion direction and production plan')
        self.c.setCreator('Game Art Review - Instant presentation builder')
        self.n=0;self.bg=CREAM;self.body=INK;self.accent=TEAL;self.boxes=[]
    def page(self,title,dark=False,subtitle=None,cover=False):
        if self.n:self.c.showPage()
        self.n+=1;self.bg=('#000000' if cover else DARK) if dark else CREAM
        self.body=CREAM if dark else INK;self.accent=GOLD if dark else TEAL
        self.c.setFillColor(HexColor(self.bg));self.c.rect(0,0,W,H,fill=1,stroke=0)
        self.c.bookmarkPage('p'+str(self.n));self.c.addOutlineEntry(title,'p'+str(self.n),level=0)
        TITLES.append(title)
        if not cover:
            self.text(title,M,42,W-2*M,size=35,font='Title',color=self.body,leading=42,maxh=54)
            if subtitle:self.text(subtitle,M,96,W-2*M,size=19,color=MUTED if not dark else '#BDC9C9',maxh=53)
            self.text(f'{self.n:02d}',W-81,H-27,30,size=12.8,color=MUTED if not dark else '#94A7A9',maxh=20)
    def text(self,text,x,y,w,size=20,font='Body',color=None,leading=None,maxh=None):
        style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.23,textColor=HexColor(color or self.body),spaceBefore=0,spaceAfter=0)
        p=Paragraph(text,style);aw,ah=p.wrap(w,2000)
        if maxh is not None and ah>maxh+0.1:raise ValueError(f'Page {self.n}: text overflow {ah:.1f}>{maxh}: {text[:70]}')
        if y+ah>H-27 and not(text==f'{self.n:02d}'):raise ValueError(f'Page {self.n}: text below safe area: {text[:70]}')
        p.drawOn(self.c,x,H-y-ah);self.boxes.append((self.n,'text',x,y,w,ah,text))
        return ah
    def block(self,title,body,x,y,w,size=19):
        ht=self.text(title,x,y,w,size=21.7,font='Bold',color=self.accent)
        return ht+14+self.text(body,x,y+ht+14,w,size=size)
    def image(self,path,x,y,w,h,gray=False,align='center',bg=None):
        path=Path(path)
        if not path.is_absolute():path=self.A/path
        if not path.exists():raise FileNotFoundError(path)
        USED.append(str(path.relative_to(self.root)))
        im=Image.open(path).convert('RGBA'); iw,ih=im.size
        scale=min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
        dx=x+(w-dw)/2;dy=y+(h-dh)/2 if align=='center' else y
        # Fit, never fill/crop: all approved artwork stays visible.
        rgb=Image.new('RGBA',im.size,bg or self.bg);rgb.alpha_composite(im);im=rgb.convert('RGB')
        if gray:im=ImageOps.grayscale(im).convert('RGB')
        im.thumbnail((max(1,round(dw*2)),max(1,round(dh*2))),Image.Resampling.LANCZOS)
        b=BytesIO();im.save(b,'JPEG',quality=94,subsampling=0);b.seek(0)
        self.c.drawImage(ImageReader(b),dx,H-dy-dh,dw,dh)
        self.boxes.append((self.n,'image',dx,dy,dw,dh,str(path)))
        return dx,dy,dw,dh
    def screen(self,device,n,x,y,w,h):return self.image(f'screens/{device}-{n:02d}.webp',x,y,w,h)
    def table(self,heads,rows,widths,x=M,y=145,size=17,headsize=None,pad=12,maxh=375):
        s=ParagraphStyle('cell',fontName='Body',fontSize=size,leading=size*1.25,textColor=HexColor(self.body))
        sh=ParagraphStyle('head',fontName='Bold',fontSize=headsize or size,leading=(headsize or size)*1.2,textColor=HexColor(CREAM))
        cells=[[Paragraph(escape(str(t)),sh) for t in heads]]+[[Paragraph(str(t),s) for t in row] for row in rows]
        t=Table(cells,colWidths=widths,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#173237')),('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor('#1B343B'),HexColor('#243F47')] if self.bg==DARK else [HexColor(CREAM),HexColor('#E9E5D9')]),('GRID',(0,0),(-1,-1),0.7,HexColor('#445759')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),pad),('RIGHTPADDING',(0,0),(-1,-1),pad),('TOPPADDING',(0,0),(-1,-1),pad),('BOTTOMPADDING',(0,0),(-1,-1),pad)]))
        tw,th=t.wrap(W,H)
        if th>maxh:raise ValueError(f'Page {self.n}: table overflow {th} > {maxh}')
        t.drawOn(self.c,x,H-y-th);self.boxes.append((self.n,'table',x,y,tw,th,'table'))
        return th
    def pair(self,title,subtitle,n,notes):
        self.page(title,subtitle=subtitle)
        self.text('MOBILE',M,150,215,size=15,font='Bold',color=TEAL)
        self.text('DESKTOP',310,150,715,size=15,font='Bold',color=TEAL)
        self.screen('mobile',n,M,177,217,370)
        self.screen('desktop',n,310,173,719,344)
        if notes:self.text(notes,310,535,719,size=15,color=MUTED,maxh=40)
    def finish(self):
        assert self.n==25,self.n
        self.c.save()
        d=fitz.open(self.out)
        assert len(d)==25
        expected={f'assets/instant-final/screens/{device}-{i:02d}.webp' for device in ['mobile','desktop'] for i in range(1,11)}
        assert expected.issubset(set(USED)),expected-set(USED)
        for p in d:
            for b in p.get_text('blocks'):
                assert b[0]>=-1 and b[1]>=-1 and b[2]<=W+1 and b[3]<=H+1,(p.number,b)
        assert any(l.get('uri','').startswith('https://www.figma.com/design/L7Q') for l in d[-1].get_links())
        audit={'pages':len(d),'page_size':[W,H],'screen_count':20,'character_boards':4,'approved_references':9,'titles':TITLES,'source_files':sorted(set(USED)),'sha256':hashlib.sha256(self.out.read_bytes()).hexdigest()}
        return audit

def build(root,out):
    register_fonts();d=Deck(root,out);a=d.A
    d.page('Pirate Sea Hop',dark=True,cover=True)
    d.text('PIRATE<br/>SEA HOP',54,112,510,size=64,font='Title',color=CREAM,leading=71,maxh=154)
    d.text('Pirate crossing instant game',56,292,475,size=26,color=CREAM)
    d.text('Art direction and production plan',56,344,460,size=21,color=GOLD)
    d.text('Norair Harutyunyan',56,490,470,size=20,color=CREAM)
    d.text('Review presentation  |  September 2026',56,531,510,size=15,color='#A9B4B5')
    d.image('art/9E1C401B-9D30-43E1-BC18-7CA63C973A00.webp',576,78,455,445,bg='#000000')
    d.page('A pirate crossing with a clear choice',dark=True)
    d.text('One more jump.<br/>Or take the treasure.',M,137,970,size=34,font='Title',leading=45)
    d.block('Game idea','Cross turquoise water by jumping between floating crates and barrels. Each safe landing creates a new choice: advance or collect the current return.',M,290,460,20)
    d.block('Intended audience','Adults of legal gambling age who prefer short instant-game sessions. This is a planning hypothesis, not a validated research finding.',566,290,463,20)
    d.block('Design distinction','A visible route makes progress easy to follow. The rear-view pirate, map and comic sea encounters provide identity without steering or combat.',M,456,976,20)
    d.page('Visual principles')
    d.block('Decision hierarchy','Read the hero and next target first, then the multiplier and cashout. Scenery supports the crossing.',55,123,454,20)
    d.block('Materials and depth','Warm sculpted wood, broad bevels, gold trim and consistent water contact. One elevated camera unifies the scene.',55,273,454,20)
    d.block('Mobile clarity','Keep the pirate silhouette, landing surfaces and control labels clear. Preserve bold white multipliers with dark outlines.',55,431,454,20)
    d.screen('desktop',3,580,117,448,219)
    d.text('Supplied interface and multiplier lettering',585,337,444,size=16,font='Bold',color=TEAL)
    d.table(['Color role','Application'],[['Turquoise','Water and route field'],['Warm wood / gold','Platforms and trim'],['Navy','Stable control panel'],['Green / yellow','Actions and cashout']],[243,205],580,382,size=15,pad=8,maxh=183)
    d.page('Moodboard')
    captions=['01  Stylized character proportions','02  Siren shape language','03  Shark silhouette','04  Coastal light and depth','05  Island forms and staging','06  Warm architecture and depth','07  Wood and metal construction','08  Treasure map language','09  Barrel construction']
    for i,ref in enumerate(d.m['references']):
        col,row=i%3,i//3;x=M+col*331;y=110+row*151
        d.image('references/'+ref['file'],x,y,308,117,gray=True)
        d.text(captions[i],x,y+122,312,size=15.5,font='Bold',color=TEAL,maxh=21)
    d.text('Nine approved references, in website order. Grayscale study; reference authorship is not claimed.',M,559,964,size=12.7,color=MUTED,maxh=16)
    d.page('Character performance')
    d.image('characters/01-pirate.png',47,125,483,302)
    d.image('characters/02-siren.png',557,125,474,302)
    d.block('Pirate: the readable route hero','The tricorn, scarf, hook and map retain a clear identity from behind. Front, back and three-quarter views define the approved design.',55,447,466,18.7)
    d.block('Siren: the mischievous sea encounter','A distinct face, hair mass and complete tail silhouette separate the siren from the other encounters. Preserve all three full-body views.',566,447,463,18.7)
    d.page('Kraken and shark')
    d.image('characters/03-kraken.png',47,124,483,306)
    d.image('characters/04-shark.png',557,124,474,306)
    d.block('Kraken: a rounded silhouette','The purple body and broad tentacle shapes establish the encounter. The board shows front, back and three-quarter construction.',55,449,466,18.7)
    d.block('Shark: a clear aquatic threat','Preserve the approved fin, tail, mouth and leg-free anatomy. The full-body views support a consistent in-game silhouette.',566,449,463,18.7)
    d.page('Environment and composition')
    d.image('art/environment-overview.png',M,112,235,443)
    d.text('Complete route',67,558,232,size=15,font='Bold',color=TEAL,maxh=19)
    for i,(file,name) in enumerate([('26D24F74-3FA2-4ADF-B2E8-820291B58905.webp','Starting ship'),('4E9A539F-8C87-4833-8AD0-751FFB96225C.webp','Floating crate'),('A11CDB16-D724-43C1-88CA-EC587CB058C3.webp','Floating barrel')]):
        y=120+i*143;d.image('art/'+file,322,y,207,107);d.text(name,329,y+112,218,size=15,font='Bold',color=TEAL)
    d.block('One readable route','Keep the hero and next landing target on the centerline. The ship deck anchors the start; the island marks the visual destination.',577,125,450,20)
    d.block('Shared camera and contact','Use consistent water gaps, surface angles, shadows and foam to ground every floating platform.',577,300,450,20)
    d.block('Mobile first','Preserve the character and controls before peripheral scenery. Check water seams and protect multipliers over bright foam.',577,449,450,20)
    d.page('Main game screen: mobile')
    d.text('First safe landing',54,108,209,size=16,font='Bold',color=TEAL)
    d.text('Route advances',293,108,209,size=16,font='Bold',color=TEAL)
    d.screen('mobile',3,54,139,211,412);d.screen('mobile',4,293,139,211,412)
    d.block('A compact crossing','The pirate and next target lead the portrait composition. Original mobile browser chrome is retained.',577,137,451,20)
    d.block('A clear decision','The lower panel keeps stake, difficulty, JUMP and CASHOUT together after a confirmed safe landing.',577,296,451,20)
    d.block('Responsive validation','Check 360, 390 and 430 px widths, long amounts, contrast and browser safe areas during production.',577,451,451,20)
    d.page('Main game screen: desktop')
    d.screen('desktop',3,M,137,731,405)
    d.block('Primary read','The central route and pirate establish the next landing target.',811,136,218,18)
    d.block('Stable actions','JUMP and CASHOUT stay grouped in the lower control panel.',811,292,218,18)
    d.block('Supporting scenery','Side props frame the route without changing the advance-or-collect decision.',811,446,218,18)
    d.page('Crossing progression: mobile',subtitle='The first six supplied frames, in the original export order.')
    labels=['01  Ready to bet','02  First jump','03  Safe landing','04  Route advances','05  Barrel landing','06  Next jump']
    for i in range(6):
        x=M+i*164;d.text(labels[i],x,160,151,size=13.5,font='Bold',color=TEAL,maxh=18);d.screen('mobile',i+1,x,191,149,295)
    d.block('One continuous crossing','The pirate leaves the ship, reaches the crate and advances to barrels. Each confirmed landing returns to the same JUMP or CASHOUT choice.',M,493,975,18)
    d.page('Crossing progression: desktop',subtitle='The same six setup and progression moments in the final landscape composition.')
    for i in range(6):
        x=M+(i%3)*331;y=149+(i//3)*203;d.text(labels[i],x,y,313,size=16,font='Bold',color=TEAL);d.screen('desktop',i+1,x,y+30,314,169)
    d.pair('Ready to bet','Stake presets and difficulty selection are visible before the pirate leaves the ship.',1,'Easy / Medium / Hard / Hardcore. BET begins the round; the artwork is preserved as supplied.')
    d.pair('Safe landing: advance or cashout','The pirate reaches the crate and the action pair becomes JUMP and CASHOUT.',3,'Production rule: update the confirmed multiplier and cashout value together after a successful landing.')
    d.pair('Route advances: barrel landing','The route changes from crates to barrels while the next target remains visible.',5,'The next jump appears in frame 06 of both progression overviews. Landing pivots must remain consistent.')
    d.pair('Tentacle encounter','The purple tentacles create a distinct interruption to the crossing.',7,'Final screen export shown unchanged. The latest combined-layer and Kraken pose references appear on page 19.')
    d.pair('Shark encounter','A shark interrupts the route with a recognizable mouth, fin and character reaction.',8,'The encounter is a visual outcome target. Game results, not animation timing, determine settlement.')
    d.pair('Siren encounter','The mermaid encounter supplies a different silhouette and a clear comic character pose.',9,'Original export state name: Mermaid encounter. The approved full-body Siren board appears on page 05.')
    d.pair('Cashout: win confirmation','A stable YOU WIN panel displays the example result over the route.',10,'The $246 result is illustrative. Production values and decimal formatting must be reconciled with the game rules.')
    d.page('Motion direction',subtitle='Supplied pose targets and proposed timing; this is not a completed Spine animation export.')
    motion=[('IMG_4809.webp','Idle: restrained movement'),('9E1C401B-9D30-43E1-BC18-7CA63C973A00.webp','Jump: 550-700 ms'),('tentacles-combined.png','Tentacles: one combined layer'),('DF70CFF3-41E1-436F-A3B7-CD210B5A7C4E.webp','01  Shark encounter pose'),('17FC7B14-020B-4501-AC7E-A98463E068A9.webp','02  Siren encounter pose'),('kraken-losing-state-03.png','03  Kraken encounter pose')]
    for i,(file,title) in enumerate(motion):
        x=M+(i%3)*250;y=146+(i//3)*208;d.text(title,x,y,240,size=13.8,font='Bold',color=TEAL,maxh=35);d.image('art/'+file,x,y+32,237,165)
    d.block('Landing','150-250 ms. Brief compression, then return to the decision pose.',820,153,207,17)
    d.block('Encounters','800-1,100 ms. Distinct poses; the result must remain readable.',820,285,207,17)
    d.block('Cashout and reset','Cashout: 600-900 ms.<br/>Reset: 300-450 ms.<br/>Reduced motion uses short pose changes.',820,416,207,17)
    d.page('One crossing, one decision at a time',dark=True,subtitle='State requirements for the production UI and animation handoff')
    d.table(['Round state','Visible action','Production requirement'],[
        ['Ready','Stake / difficulty / BET','No cashout before a successful landing.'],
        ['Resolving','Pending or disabled action','Lock repeated input while advance or cashout resolves.'],
        ['Active','JUMP or CASHOUT','Update multiplier and return together after confirmed success.'],
        ['Settled / lost','Win receipt or encounter result','Settle cashout once; a loss ends the uncashed round.'],
        ['Error / reconnect','Inline feedback','Preserve the last confirmed round state.']],[167,245,566],y=146,size=17,pad=12,maxh=351)
    d.text('Server results control settlement; animation does not award money.',M,495,975,size=23,font='Bold',color=GOLD)
    d.text('Pending, insufficient-funds and reconnection screens remain production work. Supplied artwork contains illustrative values.',M,543,975,size=17,color='#BCC9CA',maxh=30)
    d.page('Team ownership and workload',subtitle='Planning estimates for one UI Designer, one 2D Artist and one Spine Animator')
    d.table(['Owner','Owned deliverables','Depends on','Person-days'],[
        ['UI Designer','Layouts 2d; kit 2d; states 1.5d; QA 1.5d; handoff 1d.','Direction and phone hierarchy','8'],
        ['2D Artist','Audit 1d; character layers 3d; environment 2d; encounters 2d; cleanup 2d.','Approved boards and rig feasibility','10'],
        ['Spine Animator','Rig 2d; idle/jump/landing 2d; encounters 2d; cashout/reset 1d; integration 1d.','Separated art and landing pivots','8'],
        ['Art Lead','Direction, scope, review gates, risk decisions and submission checks.','Assignment and agreed direction','3'],
        ['Total','Parallel production cycle','15 working days elapsed','29']],[143,430,274,131],y=144,size=16.3,pad=11,maxh=362)
    d.text('26 specialist person-days plus 3 overlapping Art Lead days. Engineering, game mathematics, audio and certification require separate estimates.',M,533,975,size=17,color=MUTED,maxh=44)
    d.page('Milestones across 15 working days',subtitle='Each gate protects the work that depends on it')
    d.table(['Window','Main work','Acceptance gate'],[
        ['Days 1-2','Direction and layout lock','Route, phone hierarchy, silhouette, materials and rig feasibility approved.'],
        ['Days 3-5','Assets and component kit','Named layers, editable UI states and a working rig with one test jump.'],
        ['Days 6-10','Motion and integration','Idle, jump, landing, encounters, cashout and reset connected.'],
        ['Days 11-13','Device and state QA','360/390/430 px phones, desktop, contrast, reduced motion and reconnect checked.'],
        ['Days 14-15','Correction buffer and handoff','Findings resolved; named exports and Figma/PDF submission reviewed.']],[141,326,511],y=144,size=17,pad=12,maxh=371)
    d.text('Specialists work in parallel. Re-estimate after the mobile-layout and first-jump feasibility checks; protect the final correction buffer.',M,535,975,size=17,color=MUTED,maxh=44)
    d.page('Review gates and production handoffs')
    d.block('01  Composition approval','UI and 2D review the same mobile and desktop compositions. Approve the hero, next target, control hierarchy and one representative asset before building all variants.',M,145,976,21)
    d.block('02  Rig feasibility','Supply named layers, complete hidden overlaps and a shared ground pivot. Test one full jump and landing before extending the rig to every encounter.',M,299,976,21)
    d.block('03  Integrated acceptance','Review the complete round inside its UI states at actual phone size. Record owners, dependencies and acceptance criteria; use the final buffer for corrections and handoff.',M,453,976,21)
    d.page('Risks and mitigation')
    d.table(['Risk','Mitigation','Owner / checkpoint'],[
        ['Busy water','Check phone-scale contrast; protect outlines and stable readouts.','UI + Art Lead / visual gates'],
        ['Flat PNG assets','Separate limbs and effects; reconstruct hidden overlaps before rigging.','2D + Animator / asset handoff'],
        ['Landing mismatch','Share ground pivots and camera direction; approve one jump first.','Animator + Engineering / first jump'],
        ['Payout mismatch','Use authoritative values, consistent decimals and single settlement.','UI + Engineering / state QA'],
        ['Water seams / clutter','Verify tiling and keep effects away from readable values.','2D + Animator / integration'],
        ['Scope growth','Freeze direction and protect the two-day correction buffer.','Art Lead / scope review']],[212,490,276],y=128,size=16.5,pad=10,maxh=425)
    d.page('Final assets and Figma source',dark=True)
    d.block('Complete character set','Pirate, Siren, Kraken and Shark boards in the approved order, with full-body front, back and three-quarter views.',M,146,455,21)
    d.block('20 final game screens','Mobile: 10 final views.<br/>Desktop: 10 corresponding views.<br/>Original export order and artwork preserved.',567,146,462,21)
    d.text('Figma: final Instant game section',M,323,978,size=29,font='Title',color=CREAM)
    d.text('Norair Harutyunyan Test Task - INSTANT GAME',M,377,978,size=20,color='#CCD6D6')
    d.text('Selected section: 8-10993',M,414,970,size=16,color='#A5B7B9')
    bx,by,bw,bh=M,457,358,49
    d.c.setFillColor(HexColor(GOLD));d.c.roundRect(bx,H-by-bh,bw,bh,8,fill=1,stroke=0)
    d.text('Open final section in Figma',bx+18,by+14,bw-30,size=19,font='Bold',color=INK,maxh=25)
    d.c.linkURL(d.m['figma'],(bx,H-by-bh,bx+bw,H-by),relative=0,thickness=0)
    d.text('Approved artwork, nine selected references, all final screens and the production plan in one presentation. Editable layers, Spine rigs and runtime errors remain production work.',M,541,973,size=16,color='#B8C6C7',maxh=42)
    return d.finish()


def integrate(root,js,css):
    root=Path(root)
    (root/'instant-deliverables.js').write_text(js)
    (root/'instant-deliverables.css').write_text(css)
    p=root/'instant-review.js';s=p.read_text()
    if 'const instantDelivery=' not in s:
        s=s.replace(' const pages={'," const instantDelivery=active==='deliverables'?await import('/game-art-review/instant-deliverables.js?v=20260922-matched-25'):null;\n const pages={")
    s,n=re.subn(r" deliverables:\(\)=>.*?(?=\n \};)"," deliverables:()=>instantDelivery.renderInstantDeliverables(m)",s,flags=re.S)
    if n!=1:raise ValueError(f'Expected exactly one Instant Deliverables renderer; found {n}')
    p.write_text(s)
    p=root/'instant/index.html';s=p.read_text()
    match=re.search(r'<script type="importmap">(.*?)</script>',s,flags=re.S)
    data=json.loads(match.group(1)) if match else {'imports':{}}
    sources=set(data.get('imports',{}))|set(data.get('imports',{}).values())
    sources.update(re.findall(r"['\"](/game-art-review/instant-review\.js[^'\"]*)['\"]",(root/'site.js').read_text()))
    target='/game-art-review/instant-review.js?v=20260922-matched-25'
    for src in sources:
        if 'instant-review.js' in src and src!=target:data['imports'][src]=target
    tag='<script type="importmap">'+json.dumps(data,separators=(',',':'))+'</script>'
    if match:s=s[:match.start()]+tag+s[match.end():]
    else:s=s.replace('</head>',tag+'</head>')
    link='<link rel="stylesheet" href="/game-art-review/instant-deliverables.css?v=20260922-matched-25">'
    if 'instant-deliverables.css' not in s:s=s.replace('</head>',link+'</head>')
    p.write_text(s)
    # Remove only an obsolete transport entry that would overwrite the new PDF.
    transport=root/'source-notes/instant-downloads.json'
    if transport.exists():
        entries=json.loads(transport.read_text()); kept=[e for e in entries if e['path']!='assets/instant-final/downloads/Pirate_Sea_Hop_Test_Presentation.pdf']
        if entries!=kept:transport.write_text(json.dumps(kept,indent=2)+'\n')
    print('Integrated matching Instant Deliverables layout; Crash files were not modified.')

INSTANT_JS=r'''// Instant submission chapter: the same layout and section hierarchy as Crash.
const A = '/game-art-review/assets/instant-final/';
const H = section => '/game-art-review/instant/?section=' + section;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const PDF = A + 'downloads/Pirate_Sea_Hop_Test_Presentation.pdf?v=20260922-matched-25';
const evidence = [
  ['brief', 'Concept &amp; brief', 'Idea, theme, audience and differentiation'],
  ['art-direction', 'Art direction', 'Nine approved references and visual principles'],
  ['character-concept', 'Character boards', 'Pirate, Siren, Kraken and Shark'],
  ['environment', 'Environment', 'Complete route, ship, platforms and treasure island'],
  ['final-ui', 'Game screens', 'Final mobile and desktop Figma screens'],
  ['states', 'UI state library', 'Ten named states for each device'],
  ['animation', 'Motion direction', 'Combined tentacles and three losing-state references'],
  ['production', 'Production plan', 'Workload, milestones, timeline and risks']
];
export function renderInstantDeliverables(manifest) {
  const figma = esc(manifest.figma);
  return `<article class="case-chapter instant-deliverables">
    <p class="art-kicker">09 / DELIVERABLES</p>
    <h1>What is ready. What remains.</h1>
    <p class="intro">Review evidence is available in this website. The assignment’s final submission format is a Figma presentation and a matching PDF.</p>
    <div class="submission-grid">
      <section class="submission-card" id="figma">
        <span class="status">Available</span>
        <h2>Figma presentation</h2>
        <p>Instant game presentation. This link opens the specific game section supplied with the final screen exports.</p>
        <div class="preview-actions">
          <a class="link-button primary" href="${figma}" target="_blank" rel="noopener noreferrer">Open Instant game in Figma ↗</a>
          <button class="link-button" type="button" id="copy-figma">Copy Figma link</button>
        </div>
        <p id="copy-status" class="notice" role="status" aria-live="polite"></p>
        <input id="figma-url" aria-label="Figma section link" type="url" readonly value="${figma}" spellcheck="false" hidden>
      </section>
      <section class="submission-card" id="pdf">
        <span class="status">Available</span>
        <h2>Presentation PDF</h2>
        <p>25-page presentation covering the concept, grayscale moodboard, all four character boards, all 20 final screens and production plan, including the updated motion references.</p>
        <div class="preview-actions">
          <a class="link-button primary" href="${PDF}" target="_blank" rel="noopener">Open PDF</a>
          <a class="link-button" href="${PDF}" download="Instant_Game_Test_Presentation.pdf">Download PDF</a>
        </div>
      </section>
    </div>
    <section id="figma-exports">
      <h2>Final Figma screen exports</h2>
      <div class="delivery-links">
        <a href="${A}downloads/Instant_Mobile.pdf" target="_blank" rel="noopener"><strong>Mobile · all game states ↗</strong><span>Original Figma export · 10 screens</span></a>
        <a href="${A}downloads/Instant_Web.pdf" target="_blank" rel="noopener"><strong>Desktop · all game states ↗</strong><span>Original Figma export · 10 screens</span></a>
      </div>
      <div class="next-links"><a class="link-button" href="${H('final-ui')}">Browse all 20 screens</a></div>
    </section>
    <section>
      <h2>Available review evidence</h2>
      <div class="delivery-links">${evidence.map(([section,title,detail]) => `<a href="${H(section)}"><strong>${title}</strong><span>${detail}</span></a>`).join('')}</div>
    </section>
    <section id="source-assets">
      <h2>Source files</h2>
      <div class="delivery-links">
        <a href="${A}downloads/Instant_Game_Assets.zip" download><strong>Original game assets ↓</strong><span>21 supplied PNG assets · original ZIP preserved</span></a>
        <a href="${A}downloads/Instant_References.zip" download><strong>Original reference pack ↓</strong><span>15 supplied references · the approved moodboard uses nine</span></a>
        <a href="${A}downloads/Assignment_Brief.pdf" target="_blank" rel="noopener"><strong>Original assignment PDF ↗</strong><span>Test requirements and submission format</span></a>
        <a href="${H('character-concept')}"><strong>Approved character boards ↗</strong><span>Latest Pirate, Siren, Kraken and Shark boards</span></a>
      </div>
    </section>
    <section>
      <h2>Production handoff still required</h2>
      <div class="table-wrap"><table><thead><tr><th>Package</th><th>Current evidence</th><th>Remaining work</th></tr></thead><tbody>
        <tr><td>Source illustration</td><td>Approved character boards, environment and encounter poses</td><td>Editable sources, separated layers and reconstructed hidden areas</td></tr>
        <tr><td>Spine animation</td><td>Jump and encounter poses, combined tentacles and proposed timings</td><td>Continuous rigs, landing pivots, motion events, reset and runtime exports</td></tr>
        <tr><td>Interface handoff</td><td>20 final mobile/desktop screens and written state behavior</td><td>Native components, confirmed values, pending/error states and reconnect behavior</td></tr>
        <tr><td>Submission</td><td>This review website, 25-page presentation and production plan</td><td>Verify reviewer access to the supplied Figma section; Figma content is unchanged</td></tr>
      </tbody></table></div>
    </section>
    <section class="review-note">
      <h2>Before submitting</h2>
      <ul><li>Keep the PDF and Figma aligned in story and state order.</li><li>Review the main mobile and desktop screens at readable scale.</li><li>Keep reference sources separate from original project artwork.</li><li>Label estimates and unfinished production work honestly.</li><li>Check Figma access from a reviewer’s account.</li></ul>
    </section>
    <div class="next-links"><a class="link-button" href="#source-assets">Inspect source files</a><a href="${H('states')}">Read UI state requirements</a></div>
  </article>`;
}
'''

INSTANT_CSS=r'''/* Match the Crash chapter without altering other Instant pages. */
.pirate-review .instant-deliverables #figma{margin-bottom:0}
.pirate-review .instant-deliverables .delivery-links{margin-block:0}
.pirate-review .instant-deliverables .delivery-links a{min-height:0}
.pirate-review .instant-deliverables .delivery-links span{font-size:12px}
.pirate-review .instant-deliverables #copy-status:empty{display:none}
.pirate-review .instant-deliverables #figma-url{width:100%;box-sizing:border-box;margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:6px}
.pirate-review .instant-deliverables .submission-card{min-width:0}
.pirate-review .instant-deliverables .table-wrap{overflow-x:auto}
@media(max-width:760px){.pirate-review .instant-deliverables .submission-grid{grid-template-columns:1fr}.pirate-review .instant-deliverables .preview-actions .link-button{max-width:100%;white-space:normal}}
'''

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path.cwd());p.add_argument('--out',type=Path);p.add_argument('--audit',type=Path)
    args=p.parse_args();root=args.root.resolve();out=args.out or root/'assets/instant-final/downloads/Pirate_Sea_Hop_Test_Presentation.pdf'
    audit=build(root,out)
    integrate(root,INSTANT_JS,INSTANT_CSS)
    if args.audit:
        args.audit.parent.mkdir(parents=True,exist_ok=True)
        args.audit.write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps({k:v for k,v in audit.items() if k not in ('source_files','titles')},indent=2))
