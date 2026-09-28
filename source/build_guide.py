#!/usr/bin/env python3
"""
Transforme docs/guide-equipe.md en une page HTML autonome : docs/guide-equipe.html.

Les captures sont encastrées dans le fichier (data URI), pour que le guide soit
UN SEUL fichier transportable — copié sur une tablette ou déposé à côté de
l'appli, il s'ouvre sans dossier d'images à trimballer.

Le Markdown reste la source à modifier ; le HTML est régénéré.

Usage :
    python3 source/build_guide.py
"""
import base64
import html
import mimetypes
import pathlib
import re

HERE = pathlib.Path(__file__).parent
DOCS = HERE.parent / "docs"
SRC = DOCS / "guide-equipe.md"
OUT = DOCS / "guide-equipe.html"

CSS = """
:root{ color-scheme:light; --ink:#1f1c19; --muted:#6b635a; --rule:#e0d9d0;
       --bg:#faf7f3; --card:#fff; --accent:#8a5a2b; --warn:#fff8e6; --warn-rule:#e8c96a; }
*{ box-sizing:border-box; }
body{ margin:0; background:var(--bg); color:var(--ink);
      font:16px/1.65 "Iowan Old Style","Palatino Linotype",Georgia,serif; }
.wrap{ max-width:760px; margin:0 auto; padding:48px 24px 96px; }
h1{ font-size:2.1rem; line-height:1.2; margin:0 0 .4em; letter-spacing:-.01em; }
h2{ font-size:1.4rem; margin:2.4em 0 .6em; padding-top:.8em; border-top:1px solid var(--rule); }
h2:first-of-type{ border-top:0; }
/* Le Markdown sépare déjà les sections par --- : pas de double trait. */
hr + h2{ border-top:0; padding-top:0; margin-top:1.2em; }
h3{ font-size:1.1rem; margin:1.8em 0 .4em; }
p{ margin:.8em 0; }
a{ color:var(--accent); }
hr{ border:0; border-top:1px solid var(--rule); margin:2.5em 0; }
ul,ol{ padding-left:1.4em; }
li{ margin:.35em 0; }
code{ font:.88em/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
      background:#efe9e1; padding:.12em .35em; border-radius:3px; }
img{ max-width:100%; display:block; margin:1.4em 0; border:1px solid var(--rule);
     border-radius:8px; box-shadow:0 2px 14px rgba(0,0,0,.10); }
blockquote{ margin:1.4em 0; padding:.9em 1.1em; background:var(--warn);
            border-left:4px solid var(--warn-rule); border-radius:0 6px 6px 0; }
blockquote p{ margin:.35em 0; }
.tablewrap{ overflow-x:auto; margin:1.3em 0; }
table{ border-collapse:collapse; width:100%; background:var(--card); font-size:.95rem; }
th,td{ text-align:left; padding:.6em .8em; border-bottom:1px solid var(--rule);
       vertical-align:top; }
th{ background:#f2ece4; font-weight:600; font-size:.8rem; text-transform:uppercase;
    letter-spacing:.05em; }
tr:last-child td{ border-bottom:0; }
.lede{ color:var(--muted); font-size:1.05rem; }
@media print{ body{ background:#fff; } .wrap{ padding:0; max-width:none; }
              img{ box-shadow:none; break-inside:avoid; } h2{ break-after:avoid; } }
"""


def inline_image(path):
    """Encastre l'image ; si elle manque, on le dit plutôt que de casser la page."""
    p = (DOCS / path).resolve()
    if not p.exists():
        return None
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode("ascii")


def spans(text):
    """Gras, code et liens. L'échappement passe en premier pour ne pas casser le HTML."""
    out = html.escape(text)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', out)
    return out


def convert(md):
    blocks, lines, i = [], md.split("\n"), 0
    while i < len(lines):
        line = lines[i]

        if not line.strip():
            i += 1
        elif line.startswith("---") and set(line.strip()) == {"-"}:
            blocks.append("<hr>")
            i += 1
        elif line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            blocks.append(f"<h{level}>{spans(line[level:].strip())}</h{level}>")
            i += 1
        elif line.startswith("!["):
            m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
            data = inline_image(m.group(2))
            blocks.append(
                f'<img src="{data}" alt="{html.escape(m.group(1))}">' if data
                else f'<p><em>[capture manquante : {html.escape(m.group(2))}]</em></p>'
            )
            i += 1
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body = rows[0], rows[2:] if len(rows) > 1 else []
            th = "".join(f"<th>{spans(c)}</th>" for c in head)
            tb = "".join(
                "<tr>" + "".join(f"<td>{spans(c)}</td>" for c in r) + "</tr>" for r in body
            )
            blocks.append(
                f'<div class="tablewrap"><table><thead><tr>{th}</tr></thead>'
                f"<tbody>{tb}</tbody></table></div>"
            )
        elif line.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i].lstrip(">").strip())
                i += 1
            paras = "".join(f"<p>{spans(p)}</p>" for p in "\n".join(buf).split("\n\n") if p)
            blocks.append(f"<blockquote>{paras}</blockquote>")
        elif re.match(r"^\s*([-*]|\d+\.)\s", line):
            # (indentation, ordonnée ?, texte) — un seul niveau d'imbrication suffit ici.
            items = []
            while i < len(lines):
                m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                if m:
                    items.append([len(m.group(1)), m.group(2) not in "-*", m.group(3)])
                elif items and lines[i].strip():
                    items[-1][2] += " " + lines[i].strip()  # suite d'une puce sur la ligne d'après
                else:
                    break
                i += 1

            def render(nodes):
                if not nodes:
                    return ""
                base = nodes[0][0]
                tag = "ol" if nodes[0][1] else "ul"
                out, k = [], 0
                while k < len(nodes):
                    _, _, text = nodes[k]
                    child, k = [], k + 1
                    while k < len(nodes) and nodes[k][0] > base:
                        child.append(nodes[k])
                        k += 1
                    out.append(f"<li>{spans(text)}{render(child)}</li>")
                return f"<{tag}>" + "".join(out) + f"</{tag}>"

            blocks.append(render(items))
        else:
            buf = []
            while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#|\||>|!\[|\s*([-*]|\d+\.)\s)", lines[i]
            ):
                buf.append(lines[i].strip())
                i += 1
            blocks.append(f"<p>{spans(' '.join(buf))}</p>")
    return "\n".join(blocks)


def main():
    if not SRC.exists():
        raise SystemExit(f"Source introuvable : {SRC}")
    body = convert(SRC.read_text(encoding="utf-8"))
    # La première ligne de texte sert d'accroche.
    body = body.replace("<p>Ce guide s'adresse", '<p class="lede">Ce guide s\'adresse', 1)
    page = (
        "<!doctype html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        "<title>Livre de Prix — guide de l'équipe</title>\n"
        f"<style>{CSS}</style>\n</head>\n<body>\n<div class=\"wrap\">\n{body}\n</div>\n"
        "</body>\n</html>\n"
    )
    OUT.write_text(page, encoding="utf-8")
    ko = page.count("capture manquante")
    print(f"{OUT.name} généré ({len(page)//1024} Ko, captures incluses)"
          + (f" — ⚠ {ko} capture(s) manquante(s)" if ko else ""))


if __name__ == "__main__":
    main()
