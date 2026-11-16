"""Tiny streaming .xlsx reader (Python stdlib only). Used by extract_edgar_global.py."""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def shared_strings(z):
    try:
        data = z.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    out = []
    for si in root.iter(NS + "si"):
        out.append("".join(t.text or "" for t in si.iter(NS + "t")))
    return out


def sheet_paths(z):
    wb = z.read("xl/workbook.xml").decode()
    rels = z.read("xl/_rels/workbook.xml.rels").decode()
    rel_map = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    rel_map.update({k: v for v, k in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    out = {}
    for name, rid in re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
        target = rel_map[rid].lstrip("/")
        out[name] = target if target.startswith("xl/") else "xl/" + target
    return out


def rows(path, sheet):
    z = zipfile.ZipFile(path)
    sst = shared_strings(z)
    target = sheet_paths(z)[sheet]
    with z.open(target) as fh:
        for _, el in ET.iterparse(fh):
            if el.tag != NS + "row":
                continue
            row = []
            for c in el.findall(NS + "c"):
                idx = col_index(c.get("r"))
                while len(row) < idx:
                    row.append(None)
                t = c.get("t")
                v = c.find(NS + "v")
                if t == "s" and v is not None:
                    val = sst[int(v.text)]
                elif t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(NS + "t"))
                elif v is not None:
                    try:
                        val = float(v.text)
                    except ValueError:
                        val = v.text
                else:
                    val = None
                row.append(val)
            el.clear()
            yield row


if __name__ == "__main__":
    path, sheet, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
    for i, r in enumerate(rows(path, sheet)):
        if i >= n:
            break
        print([x if not isinstance(x, float) else round(x, 3) for x in r[:12]])
