# Question Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display question screenshots/diagrams extracted from the AWS SAA-C03 PDF alongside their questions in the quiz UI.

**System Architecture:** Single-page React/Vite app. Images are extracted at build/dev time via a Python script, stored as static assets in `public/`, and referenced by a new `image` field in the question JSON. No backend needed — Vite serves `public/` as static assets at the site root.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Python 3.12 + PyMuPDF (fitz) for extraction

## Global Constraints

- Python extraction script is a dev-time tool only, not bundled with the app
- Images stored as PNG in `public/images/aws-saa/` with naming convention `q{id}.png`
- The `image` field is optional — questions without diagrams omit it entirely
- No test framework is configured in this project; verification is manual (dev server + browser)

---

### Task 1: Extract images from PDF and update question data

**Files:**
- Create: `scripts/extract-images.py`
- Create: `public/images/aws-saa/` (directory + extracted PNGs)
- Modify: `src/data/exams/aws-saa/questions.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `AWS Certified Solutions Architect Associate SAA-C03.pdf` (project root)
- Produces: PNG files at `public/images/aws-saa/q{id}.png`; updated `questions.json` with `"image": "/images/aws-saa/q{id}.png"` on relevant questions

- [x] **Step 1: Install PyMuPDF**

```bash
pip install PyMuPDF
```

Verify: `python -c "import fitz; print(fitz.__doc__)"` prints version info.

- [x] **Step 2: Write the extraction script**

Create `scripts/extract-images.py`. The script must:

1. Open the PDF with `fitz.open()`
2. Iterate through pages, extracting embedded images with `page.get_images(full=True)`
3. For each image, extract it with `doc.extract_image(xref)`
4. Determine which question the image belongs to by finding the nearest question number in the page text (use regex `r"Question\s*#?\s*(\d+)"` or similar pattern matching the PDF's format)
5. Save the image as `public/images/aws-saa/q{id}.png` (convert to PNG if not already)
6. After extraction, read `src/data/exams/aws-saa/questions.json`, add `"image": "/images/aws-saa/q{id}.png"` to matching question objects, and write the file back
7. Print a summary: how many images extracted, which question IDs

```python
#!/usr/bin/env python3
"""Extract question diagrams from the AWS SAA-C03 PDF and update questions.json."""

import json
import os
import re
import sys

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_PATH = os.path.join(ROOT, "AWS Certified Solutions Architect Associate SAA-C03.pdf")
IMG_DIR = os.path.join(ROOT, "public", "images", "aws-saa")
QUESTIONS_PATH = os.path.join(ROOT, "src", "data", "exams", "aws-saa", "questions.json")


def find_question_number(page_text, img_bbox, page):
    """Find the question number closest above the image on the page."""
    matches = list(re.finditer(r"Question\s*#?\s*(\d+)", page_text))
    if not matches:
        return None

    # If only one question on the page, use it
    if len(matches) == 1:
        return int(matches[0].group(1))

    # Find the question whose text position is closest above the image
    img_top = img_bbox.y0
    best = None
    for m in matches:
        # Search for the match text position on the page
        text_instances = page.search_for(m.group(0))
        for inst in text_instances:
            if inst.y0 <= img_top:
                if best is None or inst.y0 > best[1]:
                    best = (int(m.group(1)), inst.y0)
    return best[0] if best else int(matches[0].group(1))


def extract_images():
    os.makedirs(IMG_DIR, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    question_images = {}

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text()
        image_list = page.get_images(full=True)

        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            # Skip tiny images (icons, bullets, etc.) - require at least 100x100
            base_image = doc.extract_image(xref)
            if base_image["width"] < 100 or base_image["height"] < 100:
                continue

            # Get image position on page
            img_rects = page.get_image_rects(xref)
            if not img_rects:
                continue
            img_bbox = img_rects[0]

            q_num = find_question_number(page_text, img_bbox, page)
            if q_num is None:
                print(f"  Warning: image on page {page_num + 1} could not be mapped to a question")
                continue

            # Save as PNG
            img_bytes = base_image["image"]
            ext = base_image["ext"]
            out_path = os.path.join(IMG_DIR, f"q{q_num}.png")

            if ext == "png":
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
            else:
                # Convert to PNG via fitz Pixmap
                pix = fitz.Pixmap(img_bytes)
                if pix.n > 4:  # CMYK
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                pix.save(out_path)

            question_images[q_num] = f"/images/aws-saa/q{q_num}.png"
            print(f"  Extracted image for question {q_num} -> q{q_num}.png")

    doc.close()
    return question_images


def update_questions_json(question_images):
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)

    updated = 0
    for q in questions:
        if q["id"] in question_images:
            q["image"] = question_images[q["id"]]
            updated += 1

    with open(QUESTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return updated


def main():
    if not os.path.exists(PDF_PATH):
        print(f"Error: PDF not found at {PDF_PATH}")
        sys.exit(1)

    print("Extracting images from PDF...")
    question_images = extract_images()

    if not question_images:
        print("No question images found in the PDF.")
        sys.exit(0)

    print(f"\nFound {len(question_images)} question images: {sorted(question_images.keys())}")

    print("Updating questions.json...")
    updated = update_questions_json(question_images)
    print(f"Updated {updated} questions with image paths.")


if __name__ == "__main__":
    main()
```

- [x] **Step 3: Run the extraction script**

```bash
python scripts/extract-images.py
```

Review the output. Check:
- How many images were extracted
- Which question IDs were mapped
- Whether question 96 (the user's sample) has an image

If question 96 is missing, the question-number regex may need adjusting — check the PDF's actual formatting by examining `page.get_text()` output for a page with a known diagram.

- [x] **Step 4: Verify extracted images exist**

```bash
ls public/images/aws-saa/
```

Confirm PNG files are present and reasonably sized (not corrupt tiny files). Open a few in a viewer to spot-check they're actual diagrams, not icons or decorative elements.

- [x] **Step 5: Verify questions.json was updated**

Check that the `image` field was added to the right questions:

```bash
python -c "import json; qs = json.load(open('src/data/exams/aws-saa/questions.json')); print([q['id'] for q in qs if 'image' in q])"
```

- [x] **Step 6: Add npm script to package.json**

Add `"extract:images"` to the `scripts` section of `package.json`, following the existing pattern:

```json
"extract:images": "python scripts/extract-images.py"
```

The scripts section should read:
```json
"scripts": {
    "extract": "node scripts/extract-questions.js",
    "extract:saa-c03": "node scripts/extract-saa-c03.js",
    "extract:images": "python scripts/extract-images.py",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
}
```

---

### Task 2: Display images in QuestionCard

**Files:**
- Modify: `src/components/QuestionCard.jsx`

**Interfaces:**
- Consumes: `question.image` — optional string field, a path like `"/images/aws-saa/q96.png"`, present only on questions with diagrams
- Produces: Rendered `<img>` element below question text, above answer options

- [x] **Step 1: Add image rendering to QuestionCard**

In `src/components/QuestionCard.jsx`, add a conditional `<img>` element after the question text paragraph (line 36) and before the multi-select Badge / options div (line 37).

The current code at that location:

```jsx
<p className="text-base leading-8 mb-6 tracking-wide">{question.question}</p>
{question.isMultiSelect && (
```

Insert between these two lines:

```jsx
{question.image && (
  <img
    src={question.image}
    alt="Question diagram"
    className="rounded-lg border mb-6 max-w-full"
  />
)}
```

The full section should read:

```jsx
<p className="text-base leading-8 mb-6 tracking-wide">{question.question}</p>
{question.image && (
  <img
    src={question.image}
    alt="Question diagram"
    className="rounded-lg border mb-6 max-w-full"
  />
)}
{question.isMultiSelect && (
```

- [x] **Step 2: Start the dev server and verify**

```bash
npm run dev
```

Navigate to a question that has an image (check the list from Task 1 Step 5). Verify:
- The image loads and displays below the question text
- The image is visually correct (an architecture diagram, not a corrupted/blank image)
- The image has rounded corners and a border
- Questions without images render normally with no broken image placeholder
- The layout doesn't break on narrow viewports (the image should scale down via `max-w-full`)
