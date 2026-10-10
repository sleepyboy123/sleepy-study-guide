# Proposal: Question Screenshots

## Scoping Gate

- **Tool type:** Frontend (React/Vite web app)
- **Audience/maturity:** Personal study tool
- **Scale:** Just the developer

## Why

Some AWS SAA-C03 exam questions include diagrams or screenshots as part of the question
(e.g., IAM policy JSON screenshots). These images were lost during PDF-to-JSON data
extraction. Without them, those questions are incomplete — the user can't properly answer
a question that references a diagram they can't see.

## Scope

- Extract images from the source PDF and map them to their question IDs
- Store extracted images as static assets in `public/images/aws-saa-c03/`
- Add an `images` array field to relevant questions in the C03 JSON data
- Update `QuestionCard` to render images below the question text

## Approach

1. **Image extraction** — Python script using PyMuPDF to extract images from the PDF,
   correlate them to question numbers by page position, and save as `q{id}.png` (or
   `q{id}_{n}.png` for questions with multiple images)
2. **Data update** — Add `"images": ["/images/aws-saa-c03/q{id}.png"]` to each question
   that has a screenshot (array to support multi-image questions)
3. **UI update** — QuestionCard maps over `question.images` and renders `<img>` elements
   below question text when the field is present
4. **Image placement** — Below question text, above answer options
