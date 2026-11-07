#!/usr/bin/env python3
import os
import zipfile

def create_archive():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(root_dir, 'public')
    zip_filename = os.path.join(public_dir, 'catechesis-reference-search.zip')
    
    ignore_dirs = {'node_modules', 'dist', '.git', '.aistudio', '__pycache__'}
    ignore_files = {'.env', 'catechesis-reference-search.zip'}

    os.makedirs(public_dir, exist_ok=True)
    if os.path.exists(zip_filename):
        try:
            os.remove(zip_filename)
        except Exception:
            pass

    count = 0
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for cur_root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.git')]
            for file in files:
                if file in ignore_files or file.endswith('.log') or file.endswith('.pyc'):
                    continue
                full_path = os.path.join(cur_root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                # Ignore zip inside public if encountered
                if 'catechesis-reference-search.zip' in rel_path:
                    continue
                arc_name = os.path.join('catechesis-reference-search', rel_path)
                zipf.write(full_path, arc_name)
                count += 1

    size_kb = round(os.path.getsize(zip_filename) / 1024, 2)
    print(f"✅ Successfully packaged {count} files into {zip_filename} ({size_kb} KB)")

if __name__ == '__main__':
    create_archive()
