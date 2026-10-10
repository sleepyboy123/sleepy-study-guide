#!/usr/bin/env python3
"""Extract question diagrams from the AWS SAA-C03 PDF and update questions.json."""

import json
import os
import re
import sys
from collections import defaultdict

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_PATH = os.path.join(ROOT, "AWS Certified Solutions Architect Associate SAA-C03.pdf")
EXAM_SLUG = "aws-saa-c03"
IMG_DIR = os.path.join(ROOT, "public", "images", EXAM_SLUG)
QUESTIONS_PATH = os.path.join(ROOT, "src", "data", "exams", EXAM_SLUG, "questions.json")


def find_question_number(page_text, img_bbox, page):
    """Find the question number closest above the image on the page."""
    matches = list(re.finditer(r"Question\s*#?\s*(\d+)", page_text))
    if not matches:
        return None

    if len(matches) == 1:
        return int(matches[0].group(1))

    img_top = img_bbox.y0
    best = None
    for m in matches:
        text_instances = page.search_for(m.group(0))
        for inst in text_instances:
            if inst.y0 <= img_top:
                if best is None or inst.y0 > best[1]:
                    best = (int(m.group(1)), inst.y0)
    return best[0] if best else int(matches[0].group(1))


def save_image(base_image, out_path):
    img_bytes = base_image["image"]
    ext = base_image["ext"]
    if ext == "png":
        with open(out_path, "wb") as f:
            f.write(img_bytes)
    else:
        pix = pymupdf.Pixmap(img_bytes)
        if pix.n > 4:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        pix.save(out_path)


def extract_images():
    os.makedirs(IMG_DIR, exist_ok=True)

    doc = pymupdf.open(PDF_PATH)
    # Collect all images per question, sorted by y-position
    question_image_data = defaultdict(list)

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text()
        image_list = page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            if base_image["width"] < 100 or base_image["height"] < 100:
                continue

            img_rects = page.get_image_rects(xref)
            if not img_rects:
                continue
            img_bbox = img_rects[0]

            q_num = find_question_number(page_text, img_bbox, page)
            if q_num is None:
                print(f"  Warning: image on page {page_num + 1} could not be mapped to a question")
                continue

            question_image_data[q_num].append((img_bbox.y0, base_image))

    doc.close()

    # Save images, numbering when a question has multiple
    question_images = {}
    for q_num in sorted(question_image_data):
        entries = sorted(question_image_data[q_num], key=lambda x: x[0])
        if len(entries) == 1:
            out_path = os.path.join(IMG_DIR, f"q{q_num}.png")
            save_image(entries[0][1], out_path)
            question_images[q_num] = [f"/images/{EXAM_SLUG}/q{q_num}.png"]
            print(f"  Extracted 1 image for question {q_num}")
        else:
            paths = []
            for i, (_, base_image) in enumerate(entries, 1):
                out_path = os.path.join(IMG_DIR, f"q{q_num}_{i}.png")
                save_image(base_image, out_path)
                paths.append(f"/images/{EXAM_SLUG}/q{q_num}_{i}.png")
            question_images[q_num] = paths
            print(f"  Extracted {len(entries)} images for question {q_num}")

    return question_images


def update_questions_json(question_images):
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)

    question_ids = {q["id"] for q in questions}
    orphaned = set(question_images.keys()) - question_ids
    if orphaned:
        print(f"  Warning: images extracted for question IDs not in data: {sorted(orphaned)}")

    updated = 0
    for q in questions:
        if q["id"] in question_images:
            q["images"] = question_images[q["id"]]
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

    print(f"\nFound images for {len(question_images)} questions: {sorted(question_images.keys())}")
    total = sum(len(v) for v in question_images.values())
    print(f"Total image files: {total}")

    print("Updating questions.json...")
    updated = update_questions_json(question_images)
    print(f"Updated {updated} questions with image paths.")


if __name__ == "__main__":
    main()
