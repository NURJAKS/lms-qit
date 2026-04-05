from typing import List, Any, Optional, Iterable
import io
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

def generate_xlsx_response(
    data: Iterable[List[Any]], 
    filename: str, 
    headers: List[str] | None = None,
    sheet_name: str = "Data"
) -> StreamingResponse:
    """
    Generates a StreamingResponse for an XLSX file.
    Applies professional styling: bold headers and auto-adjusted column widths.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    
    current_row = 1
    if headers:
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center")
        current_row = 2
            
    for row in data:
        ws.append(row)
        
    # Auto-adjust column width based on content
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if cell.value:
                    val_len = len(str(cell.value))
                    if val_len > max_length:
                        max_length = val_len
            except:
                pass
        # Set a reasonable limit and padding
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"},
    )
