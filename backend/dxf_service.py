import ezdxf
import io
import os
import tempfile
import uuid


def read_dxf_bytes(content: bytes):
    """Load ASCII and binary DXF content using ezdxf's format detection."""
    temp_path = None
    try:
        # readfile() auto-detects the DXF version, code page, and binary DXF
        # format. ezdxf.read() only accepts an already-decoded text stream.
        with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        return ezdxf.readfile(temp_path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

def process_dxf(content: bytes, axis: str) -> list:
    try:
        # Load DXF from bytes
        doc = read_dxf_bytes(content)
        msp = doc.modelspace()
    except Exception as e:
        raise Exception(f"Failed to parse DXF: {str(e)}")

    entities = []
    
    # Keep every model-space entity. Restricting this to a few entity types caused
    # drawings built from INSERTs, SPLINEs, HATCHes, or dimensions to look empty.
    for i, entity in enumerate(msp):
        entity_type = entity.dxftype()
        text = ""
        if entity_type == "TEXT":
            text = entity.dxf.text
        elif entity_type == "MTEXT":
            text = entity.plain_text()

        entities.append({
            'id': entity.dxf.handle if hasattr(entity.dxf, 'handle') else str(uuid.uuid4())[:8],
            'axis': axis,
            'stripIdMark': text or f"{entity_type}-{i + 1}",
            'beamWidth': 1000,
            'beamDepth': 200,
            'ptSlabDepth': 200,
            'effDepth': 175,
            'topStress': 0.0,
            'bottomStress': 0.0,
            'barDiameter': 12,
            'spacing': 200,
            'noOfBar': 5,
            'astReq': 0,
            'astProvided': 0,
            'utilization': 0,
            'status': 'PASS',
            'difference': 0,
            'steelRatio': 0,
            'layer': entity.dxf.layer,
            'type': entity_type,
        })
                
    return entities

def update_dxf(content: bytes, modified_data: list) -> bytes:
    # Open original
    doc = read_dxf_bytes(content)
    msp = doc.modelspace()
    if "REINFORCEMENT" not in doc.appids:
        doc.appids.new("REINFORCEMENT")
    
    # Create a lookup for modified data by handle
    mod_lookup = {item['id']: item for item in modified_data}
    
    for entity in msp:
        handle = entity.dxf.handle
        if handle in mod_lookup:
            mod_item = mod_lookup[handle]
            # Update specific things like text if they match
            if entity.dxftype() == 'TEXT':
                # Example: Modify text to show new spacing
                entity.dxf.text = f"{mod_item.get('noOfBar', '')}T{mod_item.get('barDiameter', '')}@{mod_item.get('spacing', '')}"
            elif entity.dxftype() == 'MTEXT':
                entity.text = f"{mod_item.get('noOfBar', '')}T{mod_item.get('barDiameter', '')}@{mod_item.get('spacing', '')}"
            
            # Add XDATA to preserve metadata perfectly
            entity.set_xdata("REINFORCEMENT", [(1000, f"SPACING={mod_item.get('spacing', '')}")])
            
    # Save back to bytes
    out_stream = io.StringIO()
    doc.write(out_stream)
    return out_stream.getvalue().encode(doc.encoding or "utf-8", errors="replace")
