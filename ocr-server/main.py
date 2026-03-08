import io
import tempfile
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import os

app = FastAPI(title="YomiToku OCR Server")

# YomiToku import
try:
    from yomitoku import Yomitoku
    from yomitoku.data import PdfData
    
    lite_mode = os.getenv("YOMITOKU_LITE_MODE", "true").lower() == "true"
    ocr = Yomitoku(lite=lite_mode)
except ImportError:
    ocr = None
    logging.warning("YomiToku not available")

class OCRResponse(BaseModel):
    text: str
    confidence: float
    structured: Optional[dict] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "yomitoku_available": ocr is not None}

@app.post("/ocr", response_model=OCRResponse)
async def recognize(
    file: UploadFile = File(...),
    lite: bool = Form(True),
    language: str = Form("ja"),
    output_format: str = Form("structured")
):
    if ocr is None:
        raise HTTPException(status_code=503, detail="YomiToku not available")
    
    content = await file.read()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Run YomiToku OCR
        if file.filename.lower().endswith('.pdf'):
            data = PdfData(tmp_path)
        else:
            from yomitoku.data import ImageData
            data = ImageData(tmp_path)
        
        result = ocr(data)
        
        text = result.text if hasattr(result, 'text') else str(result)
        confidence = result.confidence if hasattr(result, 'confidence') else 0.85
        
        # Extract structured data
        structured = extract_structured_data(text, result) if output_format == "structured" else None
        
        return OCRResponse(
            text=text,
            confidence=confidence,
            structured=structured
        )
    except Exception as e:
        logging.error(f"YomiToku OCR failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

def extract_structured_data(text: str, result) -> dict:
    """Extract structured data from YomiToku result"""
    import re
    
    # Date extraction
    date_match = re.search(r'(\d{4}[/年-]\d{1,2}[/月-]\d{1,2}日?)', text)
    date = date_match.group(1) if date_match else None
    
    # Amount extraction
    amount_matches = re.findall(r'[¥￥]?\s*([\d,]+)\s*円?', text)
    amounts = [int(a.replace(',', '')) for a in amount_matches if a.replace(',', '').isdigit()]
    
    return {
        "rawText": text,
        "date": date,
        "totalAmount": max(amounts) if amounts else None,
        "confidence": 0.85
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
