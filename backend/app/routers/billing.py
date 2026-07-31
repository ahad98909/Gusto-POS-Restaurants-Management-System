import io
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from .. import models, schemas, auth
from ..websocket_manager import manager as ws_manager

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

router = APIRouter(prefix="/billing", tags=["Billing & Invoicing"])

def build_pdf_invoice(order: models.Order, bill: models.Bill) -> io.BytesIO:
    buffer = io.BytesIO()
    # POS sized receipt or standard letter
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    story = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'ReceiptTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        alignment=1,  # Center
        spaceAfter=10
    )
    meta_style = ParagraphStyle(
        'ReceiptMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        alignment=0,  # Left
        leading=14
    )
    meta_right = ParagraphStyle(
        'ReceiptMetaRight',
        parent=meta_style,
        alignment=2  # Right
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.whitesmoke
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10
    )
    summary_cell = ParagraphStyle(
        'SummaryCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        alignment=2  # Right
    )
    
    # Title / Branding
    story.append(Paragraph("GUSTO RESTAURANT", title_style))
    story.append(Paragraph("POS INVOICE / RECEIPT", ParagraphStyle('Sub', parent=styles['Normal'], alignment=1, spaceAfter=20)))
    
    # Meta Details (Table, Order #, Server, Time)
    server_name = order.user.name if order.user else "System"
    table_num = order.table.table_number if order.table else "Takeaway"
    
    meta_text_left = f"<b>Order ID:</b> #{order.id}<br/><b>Date:</b> {bill.generated_at.strftime('%Y-%m-%d %H:%M:%S')}<br/><b>Table:</b> {table_num}"
    meta_text_right = f"<b>Server:</b> {server_name}<br/><b>Payment Status:</b> {bill.payment_status.upper()}<br/><b>Method:</b> {bill.payment_method.upper()}"
    
    meta_table_data = [
        [Paragraph(meta_text_left, meta_style), Paragraph(meta_text_right, meta_right)]
    ]
    meta_table = Table(meta_table_data, colWidths=[250, 250])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))
    
    # Itemized Table
    invoice_items = [[
        Paragraph("Item Name", table_header),
        Paragraph("Qty", table_header),
        Paragraph("Unit Price", table_header),
        Paragraph("Amount (PKR)", table_header)
    ]]
    
    for item in order.items:
        invoice_items.append([
            Paragraph(item.menu_item.name, table_cell),
            Paragraph(str(item.quantity), table_cell),
            Paragraph(f"{item.unit_price:,.2f}", table_cell),
            Paragraph(f"{(item.quantity * item.unit_price):,.2f}", table_cell)
        ])
        
    item_table = Table(invoice_items, colWidths=[240, 50, 100, 110])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')), # Dark slate header
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 15))
    
    # Summary Details
    summary_data = [
        [Paragraph("", table_cell), Paragraph("Subtotal:", summary_cell), Paragraph(f"{bill.subtotal:,.2f} PKR", summary_cell)],
        [Paragraph("", table_cell), Paragraph("Tax (16% GST):", summary_cell), Paragraph(f"{bill.tax_amount:,.2f} PKR", summary_cell)],
        [Paragraph("", table_cell), Paragraph("Discount:", summary_cell), Paragraph(f"- {bill.discount:,.2f} PKR", summary_cell)],
        [Paragraph("", table_cell), Paragraph("Total Amount:", summary_cell), Paragraph(f"{bill.total_amount:,.2f} PKR", summary_cell)]
    ]
    summary_table = Table(summary_data, colWidths=[240, 150, 110])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEABOVE', (1,3), (2,3), 1, colors.HexColor('#1E293B')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 30))
    
    # Footer
    story.append(Paragraph("Thank you for dining with us!", ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', alignment=1)))
    
    doc.build(story)
    buffer.seek(0)
    return buffer

@router.post("/request/{order_id}", response_model=schemas.BillResponse)
async def request_bill(
    order_id: int,
    bill_data: schemas.BillBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Request/Generate bill for an order.
    Calculates 16% GST and total, creates bill entry in database.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Check if a bill already exists
    existing_bill = db.query(models.Bill).filter(models.Bill.order_id == order_id).first()
    
    subtotal = order.total_amount
    tax = bill_data.tax_amount if bill_data.tax_amount > 0.0 else round(subtotal * 0.16, 2)
    discount = bill_data.discount
    total = (subtotal + tax) - discount
    
    if existing_bill:
        existing_bill.subtotal = subtotal
        existing_bill.tax_amount = tax
        existing_bill.discount = discount
        existing_bill.total_amount = total
        db.commit()
        db.refresh(existing_bill)
        bill = existing_bill
    else:
        bill = models.Bill(
            order_id=order_id,
            subtotal=subtotal,
            tax_amount=tax,
            discount=discount,
            total_amount=total,
            payment_status="unpaid",
            payment_method="cash"
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)
        
    # Alert billing screen and manager dashboard
    await ws_manager.broadcast({
        "type": "BILL_REQUESTED",
        "order_id": order.id,
        "bill_id": bill.id,
        "table_number": order.table.table_number if order.table else "Takeaway",
        "message": f"Bill requested for Table {order.table.table_number if order.table else 'Takeaway'}: {total:,.2f} PKR"
    })
    
    return bill

@router.get("/active", response_model=List[schemas.BillResponse])
def get_active_bills(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get all active bills (unpaid bills).
    """
    return db.query(models.Bill).filter(models.Bill.payment_status == "unpaid").all()

@router.get("/all", response_model=List[schemas.BillResponse])
def get_all_bills(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get all bills (paid and unpaid).
    """
    return db.query(models.Bill).order_by(models.Bill.generated_at.desc()).all()

@router.get("/order/{order_id}", response_model=schemas.BillResponse)
def get_bill_by_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get or create a bill for a specific order.
    """
    bill = db.query(models.Bill).filter(models.Bill.order_id == order_id).first()
    if not bill:
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        subtotal = order.total_amount
        tax = round(subtotal * 0.16, 2)
        bill = models.Bill(
            order_id=order_id,
            subtotal=subtotal,
            tax_amount=tax,
            discount=0.0,
            total_amount=subtotal + tax,
            payment_status="unpaid",
            payment_method="cash"
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)
    return bill


@router.put("/{bill_id}/pay", response_model=schemas.BillResponse)
async def mark_bill_paid(
    bill_id: int,
    payment_in: schemas.BillPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["billing", "manager", "owner"]))
):
    """
    Mark a bill as paid.
    Transitions order to 'billed', resets table to 'empty'.
    """
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    bill.payment_status = payment_in.payment_status
    
    if payment_in.payment_method == "card" and payment_in.card_number:
        clean_card = payment_in.card_number.replace(" ", "")
        last4 = clean_card[-4:] if len(clean_card) >= 4 else "****"
        holder = payment_in.card_holder or "Customer"
        bill.payment_method = f"card ({last4} - {holder})"
    else:
        bill.payment_method = payment_in.payment_method
    
    if payment_in.payment_status == "paid":
        order = bill.order
        order.status = "billed"
        
        # Free the table
        if order.table:
            order.table.status = "empty"
            
        db.commit()
        
        card_info_str = f" via Card ({bill.payment_method})" if "card" in payment_in.payment_method.lower() else f" via {payment_in.payment_method.upper()}"
        audit_log = models.AuditLog(
            user_id=current_user.id,
            action=f"Marked Bill #{bill.id} for Order #{order.id} as PAID{card_info_str} ({bill.total_amount} PKR)"
        )
        db.add(audit_log)
        db.commit()

        
        # Broadcast update
        await ws_manager.broadcast({
            "type": "BILL_PAID",
            "bill_id": bill.id,
            "order_id": order.id,
            "table_id": order.table_id,
            "message": f"Order #{order.id} has been settled!"
        })
        
    else:
        db.commit()
        
    return bill

@router.get("/{bill_id}/pdf")
def download_bill_pdf(
    bill_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate and stream the PDF invoice for a bill.
    """
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    order = bill.order
    pdf_buffer = build_pdf_invoice(order, bill)
    
    headers = {
        'Content-Disposition': f'attachment; filename="invoice_order_{order.id}.pdf"'
    }
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
