import os

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            if 'config.ts' in path: continue
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'http://localhost:8000' in content or 'ws://localhost:8000' in content:
                content = content.replace("'http://localhost:8000", "API_BASE_URL + '")
                content = content.replace('"http://localhost:8000', 'API_BASE_URL + "')
                content = content.replace('`http://localhost:8000', '`${API_BASE_URL}')
                content = content.replace('http://localhost:8000', '${API_BASE_URL}')
                content = content.replace('`ws://localhost:8000', '`${WS_BASE_URL}')
                
                # Determine import path depth
                depth = path.replace("\\", "/").count('/') - 2 # frontend/src is 2
                import_path = '../' * depth + 'config' if depth > 0 else './config'
                
                lines = content.split('\n')
                lines.insert(1, f'import {{ API_BASE_URL, WS_BASE_URL }} from "{import_path}";')
                
                with open(path, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                print(f'Updated {path}')
