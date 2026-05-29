import os
import shutil
from pathlib import Path
from typing import List
import json

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

def move_files_to_permanent_storage(item_type: str, item_id: int, temp_urls: List[str]) -> List[str]:
    """
    Moves files from temp storage to permanent storage for a given item.
    item_type: 'assignments' or 'materials'
    item_id: ID of the assignment or material
    temp_urls: List of URLs like '/uploads/assignments/temp/filename.ext'
    Returns: List of new permanent URLs.
    """
    if not temp_urls:
        return []

    permanent_urls = []
    item_dir = UPLOADS_DIR / item_type / str(item_id)
    item_dir.mkdir(parents=True, exist_ok=True)

    for url in temp_urls:
        if "/temp/" not in url:
            # Already permanent or external
            permanent_urls.append(url)
            continue

        filename = os.path.basename(url)
        temp_path = UPLOADS_DIR / "assignments" / "temp" / filename
        
        if not temp_path.exists():
            # If it's from materials temp, check there too (though current upload uses assignments/temp)
            temp_path = UPLOADS_DIR / "materials" / "temp" / filename

        if temp_path.exists():
            dest_path = item_dir / filename
            shutil.move(str(temp_path), str(dest_path))
            new_url = f"/uploads/{item_type}/{item_id}/{filename}"
            permanent_urls.append(new_url)
        else:
            # File not found in temp, maybe already moved or deleted
            permanent_urls.append(url)

    return permanent_urls
