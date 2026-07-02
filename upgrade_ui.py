import os
import re

views_dir = 'src/renderer/src/views'
files_to_update = ['Phone.tsx', 'Settings.tsx', 'Gallery.tsx', 'Notes.tsx', 'WorkFlowEditor.tsx']

glow_blobs = """
      {/* Ambient Background Glows */}
      <div className="pointer-events-none absolute -left-40 top-[-20%] h-[600px] w-[600px] rounded-full bg-purple-600/15 mix-blend-screen blur-[130px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[20%] h-[600px] w-[600px] rounded-full bg-fuchsia-600/15 mix-blend-screen blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/15 mix-blend-screen blur-[110px]" />
"""

for file_name in files_to_update:
    filepath = os.path.join(views_dir, file_name)
    if not os.path.exists(filepath): continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace solid backgrounds with unified Dashboard bg color
    content = content.replace('bg-[#090b0c]', 'bg-[#080a09]')
    content = content.replace('bg-[#0a0a0a]', 'bg-[#080a09]')
    
    # Inject glows after the first couple of <div className="... bg-[#080a09] ...">
    def inject_glows(match):
        # ensure relative class is present
        div_tag = match.group(0)
        if 'relative' not in div_tag:
            div_tag = div_tag.replace('className="', 'className="relative ')
        return div_tag + glow_blobs
        
    content = re.sub(r'(<div[^>]*bg-\[#080a09\][^>]*>)', inject_glows, content)
    
    # Replace dark panels with glassmorphism
    content = re.sub(r'bg-\[#101214\](/[0-9]+)?', 'bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]', content)
    content = re.sub(r'bg-\[#111\](/[0-9]+)?', 'bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]', content)
    content = re.sub(r'bg-\[#111413\](/[0-9]+)?', 'bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]', content)
    
    # Nav Buttons Active State Styling (Generic approach)
    # We will let the user experience the glassmorphism first.
    content = content.replace('border-white/10', 'border-white/20')
    content = content.replace('border-white/5', 'border-white/20')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("UI Upgrade Applied successfully!")
