"""Insert the supplied crash composition without rebuilding unrelated slides."""
from io import BytesIO
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import subprocess

root=Path(__file__).resolve().parents[1]
pdf=root/'dist/assets/deliverables/Cow_and_Aliens_Test_Presentation.pdf'
reader=PdfReader(BytesIO(subprocess.check_output(['git','show','HEAD:dist/assets/deliverables/Cow_and_Aliens_Test_Presentation.pdf'],cwd=root)))
pdfmetrics.registerFont(TTFont('Review',str(root/'dist/assets/fonts/NunitoSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('ReviewBold',str(root/'dist/assets/fonts/NunitoSans-Bold.ttf')))
assert len(reader.pages)==15, 'Crash slide already inserted or source changed'
w,h=map(float,(reader.pages[0].mediabox.width,reader.pages[0].mediabox.height))
buf=BytesIO();c=canvas.Canvas(buf,pagesize=(w,h))
c.setFillColor(HexColor('#F5F0E4'));c.rect(0,0,w,h,fill=1,stroke=0)
c.setFillColor(HexColor('#172F34'));c.setFont('ReviewBold',36)
c.drawString(50,h-70,'Round over: the grip breaks')
c.drawImage(str(root/'dist/assets/scenes/crash-reference.jpg'),50,133,width=690,height=388.125)
c.setFillColor(HexColor('#315F69'));c.setFont('ReviewBold',21)
c.drawString(773,491,'Shared crash')
c.setFillColor(HexColor('#172F34'));c.setFont('Review',17)
for i,line in enumerate(['The farmer falls.', 'The cow is abducted.', 'The final multiplier freezes.']):c.drawString(773,459-i*25,line)
c.setFillColor(HexColor('#315F69'));c.setFont('ReviewBold',21);c.drawString(773,346,'Independent results')
c.setFillColor(HexColor('#172F34'));c.setFont('Review',17)
for i,line in enumerate(['Uncollected wagers lose.', 'Collected receipts remain.', 'Replay opens a new round.']):c.drawString(773,314-i*25,line)
c.setFont('Review',16)
c.drawString(50,94,'Playable review demo: 5-second setup, automatic rise, random crash from 1.00x to 5.00x.')
c.drawString(50,69,'The image illustrates 3.72x. Demo results vary. No real wagers or production game mathematics.')
c.save();slide=PdfReader(buf).pages[0]
pages=list(reader.pages);pages.insert(8,slide)
writer=PdfWriter()
for i,page in enumerate(pages):
    if i>=8:
        b=BytesIO();n=canvas.Canvas(b,pagesize=(w,h));n.setFillColor(HexColor('#F5F0E4'));n.rect(w-82,0,64,29,fill=1,stroke=0)
        n.setFillColor(HexColor('#526B70'));n.setFont('Review',12);n.drawRightString(w-51,11,f'{i+1:02d}');n.save();page.merge_page(PdfReader(b).pages[0])
    writer.add_page(page)
writer.add_metadata({k:str(v) for k,v in (reader.metadata or {}).items() if v is not None})
out=BytesIO();writer.write(out);pdf.write_bytes(out.getvalue())
print('Inserted crash scene: 16 pages')
