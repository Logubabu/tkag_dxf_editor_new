from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Optional
import json

from dxf_service import process_dxf, update_dxf
from calc_service import optimise_entities

app = FastAPI(title="DXF Enterprise Backend")

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "DXF Enterprise Backend is running."}

@app.post("/api/upload")
async def upload_dxf(file: UploadFile = File(...), axis: str = Form(...)):
    if not file.filename.lower().endswith('.dxf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be .dxf")
    
    content = await file.read()
    try:
        data = optimise_entities(process_dxf(content, axis))
        return {"filename": file.filename, "axis": axis, "entities": data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calculate")
async def calculate_data(entities: list = Body(...), auto_correct: bool = True):
    optimized_entities = optimise_entities(entities, auto_correct=auto_correct)
    return {"entities": optimized_entities}

# Endpoint for exporting DXF not implemented yet, but defined
@app.post("/api/export-dxf")
async def export_dxf(axis: str = Form(...), original_dxf: UploadFile = File(...), modified_data: str = Form(...)):
    try:
        mod_data_parsed = json.loads(modified_data)
        dxf_content = await original_dxf.read()
        updated_dxf = update_dxf(dxf_content, mod_data_parsed)
        filename = f"updated_{original_dxf.filename or 'drawing.dxf'}"
        return StreamingResponse(
            iter([updated_dxf]),
            media_type="application/dxf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
