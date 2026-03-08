import io
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import logging
import os

try:
    from ndlocr_cli import NdloCR
    ocr = NdloCR()
except ImportError:
    ocr = None
    logging.warning("NDLOCR not available, using mock mode")

app = FastAPI(title="NDLOCR-Lite Server")

class OCRItem(BaseModel):
    name: str
    quantity: Optional[float] = None
    unitPrice: Optional[float] = None
    amount: Optional[float] = None

class OCRStructuredData(BaseModel):
    rawText: str
    date: Optional[str] = None
    totalAmount: Optional[float] = None
    taxAmount: Optional[float] = None
    taxRate: Optional[float] = None
    vendor: Optional[str] = None
    items: Optional[List[OCRItem]] = None
    confidence: float

class OCRResponse(BaseModel):
    text: str
    confidence: float
    structured: Optional[OCRStructuredData] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "ocr_available": ocr is not None}

@app.post("/ocr", response_model=OCRResponse)
async def recognize(file: UploadFile = File(...), language: str = "ja"):
    if ocr is None:
        raise HTTPException(status_code=503, detail="OCR engine not available")
    
    content = await file.read()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = ocr.recognize(tmp_path)
        
        text = result.text if hasattr(result, 'text') else str(result)
        confidence = result.confidence if hasattr(result, 'confidence') else 0.8
        
        structured = extract_structured_data(text)
        
        return OCRResponse(
            text=text,
            confidence=confidence,
            structured=structured
        )
    except Exception as e:
        logging.error(f"OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

def extract_structured_data(text: str) -> OCRStructuredData:
    import re
    
    date_match = re.search(r'(\d{4}[/年-]\d{1,2}[/月-]\d{1,2}日?)', text)
    date = date_match.group(1) if date_match else None
    
    amount_matches = re.findall(r'[¥￥]?\s*([\d,]+)\s*円?', text)
    amounts = [int(a.replace(',', '')) for a in amount_matches if a.replace(',', '').isdigit()]
    total_amount = max(amounts) if amounts else None
    
    return OCRStructuredData(
        rawText=text,
        date=date,
        totalAmount=total_amount,
        confidence=0.8
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
