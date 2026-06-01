import os
import zipfile
import sys
import fnmatch

def get_ignore_list():
    # Simple list of patterns to ignore when zipping.
    # We ignore standard heavy folders and specific secrets/temporary files.
    ignore_patterns = [
        # Heavy folders
        '.git',
        'node_modules',
        '.venv',
        'venv',
        '.next',
        'out',
        '.turbo',
        '__pycache__',
        
        # Databases (exclude to keep it clean and small; will bootstrap locally)
        'app.db',
        'sql_app.db',
        'test.db',
        
        # Environments (confidential local keys; env.example will be copied)
        '.env',
        '.env.local',
        '.env.production',
        '.env.development',
        '.env.deploy',
        
        # IDEs / System files
        '.vscode',
        '.idea',
        '.cursor',
        '.DS_Store',
        'Thumbs.db',
        
        # Log and temporary files
        '*.log',
        '*.zip',
        'scratch',
        'scratch_admin.txt',
        'status_report.txt',
        'alert_list.txt',
        'notification_fix_report.txt',
    ]
    return ignore_patterns

def should_ignore(path, root_dir, ignore_patterns):
    relative_path = os.path.relpath(path, root_dir)
    parts = relative_path.split(os.sep)
    
    # Check if any parent folder matches an ignored pattern
    for part in parts:
        for pattern in ignore_patterns:
            if fnmatch.fnmatch(part, pattern):
                return True
    
    # Also check full relative path or filename
    filename = os.path.basename(path)
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(relative_path, pattern):
            return True
            
    return False

def create_zip(output_filename="lms-platform.zip"):
    root_dir = os.path.abspath(os.path.dirname(__file__))
    ignore_patterns = get_ignore_list()
    
    print(f"📦 Инициализация сборки ZIP архива: {output_filename}")
    print(f"📁 Исходный каталог: {root_dir}")
    print("🧹 Исключаются: .git, node_modules, .venv, .next, .env файлы, базы данных SQLite и кэши.")
    
    count = 0
    ignored_count = 0
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to avoid traversing ignored directories
            dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), root_dir, ignore_patterns)]
            
            for file in files:
                file_path = os.path.join(root, file)
                if should_ignore(file_path, root_dir, ignore_patterns):
                    ignored_count += 1
                    continue
                
                arcname = os.path.relpath(file_path, root_dir)
                zipf.write(file_path, arcname)
                count += 1
                if count % 100 == 0:
                    print(f"  ⚡ Добавлено {count} файлов...")
                    
    zip_size_mb = os.path.getsize(output_filename) / (1024 * 1024)
    print("==========================================================")
    print(f"🎉 Сборка завершена успешно!")
    print(f"📚 Всего файлов упаковано: {count}")
    print(f"🧹 Всего файлов исключено: {ignored_count}")
    print(f"💾 Размер архива: {zip_size_mb:.2f} MB")
    print(f"👉 Передайте файл '{output_filename}' другому человеку.")
    print("==========================================================")

if __name__ == "__main__":
    create_zip()
