#!/usr/bin/env python3
"""
Builds the web-ready UI textures in assets/ui/ from Blizzard's own WoW Classic interface art.

Source: https://github.com/Gethe/wow-ui-textures (branch "classic"), a PNG mirror of the
game's Interface\\ textures. Nothing here is hand-drawn; images are only cropped or rearranged:

  * Border "edge files" (e.g. UI-DialogBox-Border) are 8 squares in a row
    [left, right, top, bottom, top-left, top-right, bottom-left, bottom-right],
    with top/bottom stored rotated. They are rearranged into a 3x3 "9-slice" so CSS
    border-image can use them.
  * Buttons / edit boxes / header plates are cropped to the area the game actually draws.

Usage:  python tools/build-ui-textures.py      (needs Pillow: pip install pillow)
"""
import io
import os
import urllib.request

from PIL import Image, ImageDraw

BASE = "https://raw.githubusercontent.com/Gethe/wow-ui-textures/classic/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "ui")


def fetch(path):
    with urllib.request.urlopen(BASE + path + ".PNG", timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def save(im, name):
    im.save(os.path.join(OUT, name + ".png"), optimize=True)
    print(f"  {name}.png  {im.width}x{im.height}")


def nine_slice(edge):
    """Edge file (8 squares in a row) -> 3x3 image for CSS border-image."""
    e = edge.height
    seg = [edge.crop((i * e, 0, (i + 1) * e, e)) for i in range(8)]
    out = Image.new("RGBA", (3 * e, 3 * e))
    out.paste(seg[4], (0, 0))
    out.paste(seg[5], (2 * e, 0))
    out.paste(seg[6], (0, 2 * e))
    out.paste(seg[7], (2 * e, 2 * e))
    out.paste(seg[0], (0, e))
    out.paste(seg[1], (2 * e, e))
    out.paste(seg[2].rotate(-90, expand=True), (e, 0))
    out.paste(seg[3].rotate(-90, expand=True), (e, 2 * e))
    return out


def crop_alpha(im):
    """Crop to the visible (non-transparent) area."""
    return im.crop(im.getchannel("A").getbbox())


def remove_dragon_tail(im):
    """UI-DialogBox-Gold-Dragon has a separate tail piece along the bottom that would reach into the
    frame's content. Clear it (everything right of the body below y=80, and right of x=34 below y=97)."""
    im = im.copy()
    px = im.load()
    for y in range(80, im.height):
        x0 = 42 if y < 97 else 34
        for x in range(x0, im.width):
            px[x, y] = (0, 0, 0, 0)
    return crop_alpha(im)


def crest(size, ring, icon):
    """Favicon: the page-header crest, i.e. the Darkmoon ticket icon cut to a circle inside COMMON/GoldRing.
    Same proportions as the header (.crest: 88px ring, 64px icon inset 12px)."""
    out = Image.new("RGBA", (size, size))
    inner = round(size * 64 / 88)
    off = (size - inner) // 2
    ic = icon.resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner * 4, inner * 4))
    ImageDraw.Draw(mask).ellipse((0, 0, inner * 4 - 1, inner * 4 - 1), fill=255)
    out.paste(ic, (off, off), mask.resize((inner, inner), Image.LANCZOS))
    out.alpha_composite(ring.resize((size, size), Image.LANCZOS))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    print("Writing to", os.path.normpath(OUT))

    # Frames (StaticPopup / dialog box style) and tooltips
    save(nine_slice(fetch("DialogFrame/UI-DialogBox-Gold-Border")), "frame-border-gold")
    save(nine_slice(fetch("DialogFrame/UI-DialogBox-Border")), "frame-border")
    save(nine_slice(fetch("Tooltips/UI-Tooltip-Border")), "tooltip-border")
    save(fetch("DialogFrame/UI-DialogBox-Background"), "frame-background")
    save(crop_alpha(fetch("DialogFrame/UI-DialogBox-Gold-Header")), "header-gold")
    save(crop_alpha(fetch("DialogFrame/UI-DialogBox-Divider")), "divider")
    save(remove_dragon_tail(fetch("DialogFrame/UI-DialogBox-Gold-Dragon")), "dragon")
    save(fetch("FrameGeneral/UI-Background-Rock"), "page-background")

    # Red panel button: the game uses texcoords 0..0.625 x 0..0.6875 (80x22 of 128x32)
    for state in ("Up", "Down", "Highlight", "Disabled"):
        save(fetch(f"Buttons/UI-Panel-Button-{state}").crop((0, 0, 80, 22)), f"button-{state.lower()}")

    # Edit box, check box, item slots, auction rows, highlight, coins
    save(crop_alpha(fetch("COMMON/Common-Input-Border")), "input")
    save(fetch("Buttons/UI-CheckBox-Up"), "checkbox")
    save(fetch("Buttons/UI-CheckBox-Check"), "checkbox-check")
    save(fetch("Buttons/UI-CheckBox-Highlight"), "checkbox-highlight")
    save(fetch("Buttons/UI-Quickslot2"), "slot-frame")
    save(fetch("Buttons/UI-EmptySlot"), "slot-empty")
    save(crop_alpha(fetch("AUCTIONFRAME/UI-AuctionItemNameFrame")), "row")
    save(fetch("QUESTFRAME/UI-QuestTitleHighlight"), "row-highlight")
    ring = fetch("COMMON/GoldRing")
    save(ring, "gold-ring")
    ticket = fetch("ICONS/INV_Misc_Ticket_Darkmoon_01")
    save(crest(64, ring, ticket), "favicon")
    save(crest(32, ring, ticket), "favicon-32")
    # big copy for the README header (docs/ is not part of the published site)
    docs = os.path.join(OUT, "..", "..", "docs")
    os.makedirs(docs, exist_ok=True)
    crest(192, ring, ticket).save(os.path.join(docs, "logo.png"), optimize=True)
    print("  ../../docs/logo.png  192x192")
    save(crop_alpha(fetch("GossipFrame/AvailableQuestIcon")), "quest-icon")   # yellow "!" from NPC quest lists
    for coin in ("Gold", "Silver", "Copper"):
        save(fetch(f"MONEYFRAME/UI-{coin}Icon"), f"coin-{coin.lower()}")


if __name__ == "__main__":
    main()
