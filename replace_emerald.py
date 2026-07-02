import os
import re

src_dir = 'src/renderer/src'

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip replacing network state emerald in IRIS.tsx
            # We'll temporarily hide it by renaming it to __TEMP_EMERALD__
            if file == 'IRIS.tsx':
                content = content.replace("'text-emerald-400'", "'__TEMP_EMERALD__'")
            
            # Replace emerald colors with white
            content = re.sub(r'text-emerald-\d00(?:/\d+)?', 'text-white', content)
            content = re.sub(r'bg-emerald-\d00/(\d+)', r'bg-white/\1', content)
            content = re.sub(r'bg-emerald-\d00', 'bg-white', content)
            content = re.sub(r'border-emerald-\d00/(\d+)', r'border-white/\1', content)
            content = re.sub(r'border-emerald-\d00', 'border-white/30', content)
            content = re.sub(r'from-emerald-\d00', 'from-white', content)
            content = re.sub(r'to-emerald-\d00', 'to-white', content)
            content = re.sub(r'via-emerald-\d00', 'via-white', content)
            
            # Replace HEX codes
            content = content.replace('#10b981', '#ffffff')
            content = content.replace('rgba(16,185,129', 'rgba(255,255,255')
            
            # Restore IRIS.tsx network state
            if file == 'IRIS.tsx':
                content = content.replace("'__TEMP_EMERALD__'", "'text-emerald-400'")
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

print("Emerald replaced with White successfully!")
