import zipfile
from pathlib import Path

path = Path('hpe-proposal-template.pptx')
with zipfile.ZipFile(path, 'r') as z:
    for name in z.namelist():
        if name.startswith('ppt/') and name.endswith('.xml'):
            data = z.read(name).decode('utf-8', 'ignore')
            if any(x in data for x in ['docTitle', 'docTytle', 'fileName']):
                print('---', name)
                for line in data.splitlines():
                    if any(x in line for x in ['docTitle', 'docTytle', 'fileName']):
                        print(line)
