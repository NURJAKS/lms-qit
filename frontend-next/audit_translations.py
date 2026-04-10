
import os
import re

def extract_keys_from_src(src_path):
    # Regex to find t("key") or t('key') or t(`key`)
    # We use a more specific regex to avoid matching things like apiClient.get("...")
    # Typically t is called as t("key")
    pattern = re.compile(r"\bt\s*\(\s*['\"`]([^'\"`]+)['\"`]\s*\)")
    
    findings = []
    
    for root, dirs, files in os.walk(src_path):
        for file in files:
            if file.endswith(('.tsx', '.ts')) and not file.endswith('.test.ts'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for i, line in enumerate(f, 1):
                            matches = pattern.findall(line)
                            for key in matches:
                                findings.append({
                                    'key': key,
                                    'file': os.path.relpath(path, src_path),
                                    'line': i
                                })
                except Exception as e:
                    pass
    return findings

def get_keys_from_translations(translations_path):
    # Keys are usually like:  key: 'value'
    pattern = re.compile(r"^\s*['\"]?([a-zA-Z0-9_-]+)['\"]?\s*:", re.MULTILINE)
    
    keys = set()
    if os.path.exists(translations_path):
        with open(translations_path, 'r', encoding='utf-8') as f:
            content = f.read()
            keys.update(pattern.findall(content))
    return keys

if __name__ == "__main__":
    src_dir = "/home/nurjaks/Dev/LMS platform - order/frontend-next/src"
    trans_file = os.path.join(src_dir, "i18n/translations.ts")
    
    used_findings = extract_keys_from_src(src_dir)
    defined_keys = get_keys_from_translations(trans_file)
    
    missing_findings = []
    for f in used_findings:
        key = f['key']
        if key not in defined_keys:
            # Filter out obvious false positives
            if '/' in key or ' ' in key or '.' in key or '${' in key or key.isdigit():
                continue
            missing_findings.append(f)
            
    # Group by key
    grouped = {}
    for f in missing_findings:
        key = f['key']
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(f"{f['file']}:{f['line']}")
        
    print(f"Audit Results - Total used keys: {len(set(f['key'] for f in used_findings))}")
    print(f"Total defined keys: {len(defined_keys)}")
    print(f"\nMissing Keys Table:")
    print(f"| Key | Occurrences |")
    print(f"| --- | --- |")
    for key in sorted(grouped.keys()):
        locs = ", ".join(grouped[key][:3]) # Show first 3 locations
        if len(grouped[key]) > 3:
            locs += f", ... (+{len(grouped[key]) - 3})"
        print(f"| {key} | {locs} |")
