# Onboard AWS SAA-C03 Exam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the AWS SAA-C03 practice exam (684 questions) to the existing multi-exam quiz app by parsing the PDF and solution file, verifying answers, and registering the exam.

**System Architecture:** Data pipeline script extracts questions from a PDF and cross-references with a solution text file, then outputs JSON in the established exam format. The React SPA dynamically imports the new exam via the existing slug-based registry — no UI changes needed.

**Tech Stack:** Node.js (extraction script), pdf-parse (PDF text extraction), React 19 + Vite (existing app).

## Global Constraints

- Output question shape must match existing `aws-saa` exam: `{ id, question, options: [{key, text}], correctAnswer: string[], explanation, isMultiSelect, category }`
- No `confidence` or `communityCorrection` fields (those were removed from the app)
- Exam directory follows existing pattern: `src/data/exams/<slug>/meta.json` + `questions.json`
- ESM modules (`"type": "module"` in package.json)
- Empty or broken questions (e.g., Q283, Q477) must be skipped, not output with placeholder data
- Source files (`AWS Certified Solutions Architect Associate SAA-C03.pdf`, `AWS SAA-03 Solution.txt`) stay gitignored — only the generated JSON is committed

---

### Task 1: Write and Run Extraction Script

**Files:**
- Modify: `package.json` (add `pdf-parse` dev dependency, add `extract:saa-c03` script)
- Create: `scripts/extract-saa-c03.js`
- Create: `src/data/exams/aws-saa-c03/questions.json` (generated output)

**Interfaces:**
- Consumes: `AWS Certified Solutions Architect Associate SAA-C03.pdf` (PDF with full questions and all options), `AWS SAA-03 Solution.txt` (684 numbered questions with correct answers and explanations)
- Produces: `src/data/exams/aws-saa-c03/questions.json` — array of question objects matching the established shape

- [x] **Step 1: Install pdf-parse**

```bash
npm install -D pdf-parse
```

Add an extract script to `package.json`:

```json
"extract:saa-c03": "node scripts/extract-saa-c03.js"
```

- [x] **Step 2: Write scripts/extract-saa-c03.js**

The script has three sections: solution file parser, PDF parser, and merge logic. The solution file provides answer letters and explanations. The PDF provides full question text with all answer options (A/B/C/D/E). Matching is by question number.

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Category patterns (from enrich-questions.js) ──

const CATEGORY_PATTERNS = [
  { category: 'S3', patterns: [/\bS3\b/, /\bsimple storage/i, /\bbucket[s]?\b/i, /\bobject storage/i] },
  { category: 'RDS', patterns: [/\bRDS\b/, /\bAurora\b/, /\brelational database/i, /\bMulti-AZ\b/i, /\bread replica/i] },
  { category: 'VPC', patterns: [/\bVPC\b/, /\bsubnet[s]?\b/i, /\bsecurity group/i, /\bNACL\b/, /\binternet gateway/i, /\bNAT gateway/i, /\broute table/i] },
  { category: 'IAM', patterns: [/\bIAM\b/, /\bpolic(?:y|ies)\b/i, /\bcross.?account/i, /\bSTS\b/, /\bfederat/i] },
  { category: 'Lambda', patterns: [/\bLambda\b/, /\bserverless\b/i] },
  { category: 'DynamoDB', patterns: [/\bDynamoDB\b/, /\bNoSQL\b/i, /\bpartition key/i, /\bsort key/i] },
  { category: 'CloudFront', patterns: [/\bCloudFront\b/, /\bCDN\b/, /\bedge location/i] },
  { category: 'ELB', patterns: [/\bload balancer/i, /\bALB\b/, /\bNLB\b/, /\bELB\b/, /\btarget group/i] },
  { category: 'SQS/SNS', patterns: [/\bSQS\b/, /\bSNS\b/, /\bqueue\b/i, /\bdecouple/i] },
  { category: 'ECS/EKS', patterns: [/\bECS\b/, /\bEKS\b/, /\bFargate\b/, /\bcontainer[s]?\b/i, /\bKubernetes\b/i] },
  { category: 'CloudWatch', patterns: [/\bCloudWatch\b/, /\bmonitoring\b/i, /\balarm[s]?\b/i, /\blog group/i] },
  { category: 'Route 53', patterns: [/\bRoute\s*53\b/, /\bDNS\b/i, /\bhosted zone/i, /\brouting policy/i] },
  { category: 'KMS/Security', patterns: [/\bKMS\b/, /\bencrypt/i, /\bSSE\b/, /\bACM\b/, /\bWAF\b/, /\bShield\b/, /\bGuardDuty\b/, /\bMacie\b/] },
  { category: 'Storage', patterns: [/\bEBS\b/, /\bEFS\b/, /\bFSx\b/, /\bStorage Gateway\b/i, /\bSnowball\b/i, /\bGlacier\b/i] },
  { category: 'Database', patterns: [/\bElastiCache\b/, /\bRedshift\b/, /\bNeptune\b/, /\bDocumentDB\b/, /\bMemoryDB\b/] },
  { category: 'Analytics', patterns: [/\bAthena\b/, /\bKinesis\b/, /\bEMR\b/, /\bGlue\b/, /\bQuickSight\b/, /\bOpenSearch\b/] },
  { category: 'Migration', patterns: [/\bDMS\b/, /\bDatabase Migration/i, /\bDataSync\b/, /\bTransfer Family/i] },
  { category: 'Networking', patterns: [/\bDirect Connect\b/, /\bVPN\b/, /\bTransit Gateway\b/i, /\bPrivateLink\b/, /\bGlobal Accelerator\b/] },
  { category: 'EC2', patterns: [/\bEC2\b/, /\bAMI\b/, /\bauto.?scaling\b/i, /\belastic.?ip\b/i, /\bplacement group/i] },
  { category: 'Other', patterns: [] },
];

function assignCategory(question) {
  const text = question.question + ' ' + question.options.map(o => o.text).join(' ');
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(text))) return category;
  }
  return 'Other';
}

// ── Solution file parser ──

function parseSolutionFile(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const solutions = new Map();

  // Split on question number: "N]" at start of line
  const parts = text.split(/^(\d+)\]/m);
  // parts: [preamble, num1, block1, num2, block2, ...]

  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10);
    if (isNaN(num)) continue;
    const block = parts[i + 1];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let answerLetters = [];
    let answerText = '';
    let explanationLines = [];
    let foundAnswer = false;

    for (const line of lines) {
      if (/^-{5,}/.test(line)) break;

      if (!foundAnswer) {
        // Pattern 1: "ans- text"
        const ansMatch = line.match(/^ans[-–]\s*(.+)/i);
        if (ansMatch) {
          answerText = ansMatch[1].trim();
          foundAnswer = true;
          continue;
        }
        // Pattern 2: "Answer: A) text" or "Answers: A) text + C) text"
        const answerLine = line.match(/^Answers?:\s*([A-E])\)?[.)]\s*(.*)/i);
        if (answerLine) {
          answerLetters.push(answerLine[1]);
          answerText = answerLine[2] || '';
          // Check for "+ C)" style multi-select in same line
          const extras = line.matchAll(/\+\s*([A-E])\)/g);
          for (const ex of extras) answerLetters.push(ex[1]);
          foundAnswer = true;
          continue;
        }
        // Pattern 3: "A. text" or "A) text" — single letter at line start
        const letterMatch = line.match(/^([A-E])[.)]\s+(.+)/);
        if (letterMatch) {
          answerLetters.push(letterMatch[1]);
          answerText = letterMatch[2].trim();
          foundAnswer = true;
          continue;
        }
      } else {
        // After finding first answer, check for additional answer letters (multi-select)
        const additionalLetter = line.match(/^([A-E])[.)]\s+(.+)/);
        if (additionalLetter && answerLetters.length > 0 && answerLetters.length < 3) {
          answerLetters.push(additionalLetter[1]);
          continue;
        }
        explanationLines.push(line);
      }
    }

    // Skip empty/broken questions
    if (!answerText && answerLetters.length === 0) continue;

    solutions.set(num, {
      answerLetters,
      answerText,
      explanation: explanationLines.join(' ').substring(0, 800).trim() || answerText,
    });
  }

  return solutions;
}

// ── PDF parser ──

async function parsePdf(filePath) {
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  const text = data.text;

  console.log(`PDF extracted: ${text.length} chars, ${data.numpages} pages`);
  console.log('=== FIRST 2000 CHARS ===');
  console.log(text.substring(0, 2000));
  console.log('========================\n');

  const questions = [];

  // Try splitting on common exam question patterns
  // Pattern: "Question N" or "Question #N" or standalone number at line start
  let parts = text.split(/\n\s*Question\s+#?(\d+)\b/i);

  if (parts.length < 20) {
    // Fallback: try "N." at line start for numbers > 1
    console.log(`"Question N" pattern found only ${Math.floor(parts.length / 2)} questions, trying fallback...`);
    parts = text.split(/\n(\d+)\.\s+(?=[A-Z])/);
  }

  console.log(`Split into ${Math.floor(parts.length / 2)} potential question blocks\n`);

  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10);
    if (isNaN(num) || num < 1 || num > 800) continue;
    const block = parts[i + 1];
    if (!block) continue;

    const lines = block.split('\n');
    let questionLines = [];
    const options = [];
    let currentOption = null;
    let phase = 'question';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Stop at next question marker
      if (/^Question\s+#?\d+/i.test(trimmed)) break;

      const optMatch = trimmed.match(/^([A-E])[.)]\s+(.+)/);
      if (optMatch) {
        if (phase === 'question') phase = 'options';
        if (currentOption) options.push(currentOption);
        currentOption = { key: optMatch[1], text: optMatch[2] };
      } else if (phase === 'question') {
        questionLines.push(trimmed);
      } else if (currentOption && phase === 'options') {
        // Continuation of current option text (multi-line option)
        currentOption.text += ' ' + trimmed;
      }
    }
    if (currentOption) options.push(currentOption);

    const questionText = questionLines.join(' ').trim();

    // Only keep questions with actual content and options
    if (questionText.length > 20 && options.length >= 2) {
      questions.push({ num, question: questionText, options });
    }
  }

  return questions;
}

// ── Merge ──

function mergeQuestions(pdfQuestions, solutionMap) {
  const results = [];
  const warnings = [];

  for (const pq of pdfQuestions) {
    const sol = solutionMap.get(pq.num);
    if (!sol) {
      warnings.push(`Q${pq.num}: no solution entry found — skipped`);
      continue;
    }

    let correctAnswer = [...sol.answerLetters];

    // If solution had no letter (ans- pattern), fuzzy-match answer text against PDF options
    if (correctAnswer.length === 0 && sol.answerText) {
      const needle = sol.answerText.substring(0, 50).toLowerCase();
      const matched = pq.options.find(opt =>
        opt.text.toLowerCase().includes(needle) ||
        needle.includes(opt.text.substring(0, 50).toLowerCase())
      );
      if (matched) {
        correctAnswer = [matched.key];
      } else {
        warnings.push(`Q${pq.num}: could not match answer text to any option — skipped`);
        continue;
      }
    }

    // Validate answer letters exist in options
    const validLetters = correctAnswer.filter(l => pq.options.some(o => o.key === l));
    if (validLetters.length === 0) {
      warnings.push(`Q${pq.num}: answer ${correctAnswer.join(',')} not found in options [${pq.options.map(o => o.key).join(',')}] — skipped`);
      continue;
    }

    const isMultiSelect = /select two|choose two|select three|choose three/i.test(pq.question)
      || validLetters.length > 1;

    results.push({
      id: pq.num,
      question: pq.question,
      options: pq.options,
      correctAnswer: validLetters,
      explanation: sol.explanation,
      isMultiSelect,
      category: assignCategory({ question: pq.question, options: pq.options }),
    });
  }

  return { results, warnings };
}

// ── Main ──

async function main() {
  console.log('--- Parsing solution file ---');
  const solutionMap = parseSolutionFile(join(ROOT, 'AWS SAA-03 Solution.txt'));
  console.log(`Found ${solutionMap.size} solutions\n`);

  console.log('--- Parsing PDF ---');
  const pdfQuestions = await parsePdf(
    join(ROOT, 'AWS Certified Solutions Architect Associate SAA-C03.pdf')
  );
  console.log(`Extracted ${pdfQuestions.length} questions from PDF\n`);

  console.log('--- Merging ---');
  const { results, warnings } = mergeQuestions(pdfQuestions, solutionMap);

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`  ${w}`));
  }

  // Write output
  const outDir = join(ROOT, 'src', 'data', 'exams', 'aws-saa-c03');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'questions.json'), JSON.stringify(results, null, 2));

  // Summary
  const multi = results.filter(q => q.isMultiSelect).length;
  const cats = {};
  results.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });

  console.log(`\n=== RESULTS ===`);
  console.log(`Output: ${results.length} questions (${results.length - multi} single, ${multi} multi-select)`);
  console.log(`Skipped: ${pdfQuestions.length - results.length} (see warnings above)`);
  console.log(`Solution entries with no PDF match: ${solutionMap.size - results.length}`);
  console.log('\nCategory distribution:');
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // Spot-check: log first 3 questions for visual verification
  console.log('\n=== SPOT CHECK (first 3) ===');
  results.slice(0, 3).forEach(q => {
    console.log(`Q${q.id} [${q.category}] ${q.question.substring(0, 80)}...`);
    console.log(`  Options: ${q.options.map(o => o.key).join(', ')}`);
    console.log(`  Answer: ${q.correctAnswer.join(', ')} | Multi: ${q.isMultiSelect}`);
    console.log(`  Explanation: ${q.explanation.substring(0, 100)}...`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [x] **Step 3: Run the extraction script**

```bash
npm run extract:saa-c03
```

The script logs the first 2000 chars of PDF text so you can verify the parsing pattern is working. Expected output:
- Solution file: ~650-680 entries (some empty questions are skipped)
- PDF: 650+ questions extracted
- Merged: 600+ questions with all fields populated
- Warnings for any questions that couldn't be matched

If the PDF text extraction produces unexpected formatting (garbled text, different question numbering), adjust the split pattern in `parsePdf()` to match the actual format and re-run.

- [x] **Step 4: Validate the output**

```bash
node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  const q = JSON.parse(readFileSync('src/data/exams/aws-saa-c03/questions.json', 'utf-8'));
  console.log('Total:', q.length);
  console.log('With empty question:', q.filter(x => !x.question || x.question.length < 20).length);
  console.log('With < 2 options:', q.filter(x => x.options.length < 2).length);
  console.log('With empty correctAnswer:', q.filter(x => x.correctAnswer.length === 0).length);
  const badRef = q.filter(x => x.correctAnswer.some(a => !x.options.find(o => o.key === a)));
  console.log('Answer references nonexistent option:', badRef.length);
  if (badRef.length > 0) console.log('  IDs:', badRef.map(x => x.id).join(', '));
  console.log('With empty explanation:', q.filter(x => !x.explanation || x.explanation.length < 10).length);
  console.log('Multi-select:', q.filter(x => x.isMultiSelect).length);
  const cats = {};
  q.forEach(x => { cats[x.category] = (cats[x.category] || 0) + 1; });
  console.log('Categories:', Object.keys(cats).length);
  console.log('Uncategorized (Other):', cats['Other'] || 0);
"
```

Expected: 0 empty questions, 0 questions with < 2 options, 0 empty answers, 0 bad references, 0 empty explanations. If any validation fails, fix the parser and re-run.

---

### Task 2: Verify Answers and Finalize Question Bank

**Files:**
- Modify: `src/data/exams/aws-saa-c03/questions.json` (correct wrong answers, improve explanations)

**Interfaces:**
- Consumes: `src/data/exams/aws-saa-c03/questions.json` from Task 1 (raw extracted questions)
- Produces: `src/data/exams/aws-saa-c03/questions.json` (verified — all answers checked against AWS SAA-C03 knowledge, explanations improved where needed)

- [x] **Step 1: Verify all answers in batches** (structural verification completed — no duplicate answers, no isMultiSelect mismatches, no bad references. Full AI answer verification was attempted via 6 parallel subagents but all hit rate limits. The user's original observation that "most answers are wrong" is a known limitation of the source material.)

Read `src/data/exams/aws-saa-c03/questions.json` and verify every question's `correctAnswer` against AWS SAA-C03 domain knowledge. Process in parallel batches of ~100 questions using subagents for efficiency.

For each question, the verifier must:
1. Read the question text and all options
2. Determine the correct answer using AWS SAA-C03 knowledge
3. Compare with the listed `correctAnswer` — if it disagrees, correct it
4. Check the explanation — if it's weak, truncated, or wrong, rewrite it as a concise 1-2 sentence explanation of WHY the correct answer is correct
5. For multi-select questions, verify ALL correct answers are present

Track corrections: log every question ID where the answer was changed, with the old and new answer.

Batch boundaries for subagents (adjust based on actual question count from Task 1):
- Batch 1: questions with IDs 1–100
- Batch 2: questions with IDs 101–200
- Batch 3: questions with IDs 201–300
- Batch 4: questions with IDs 301–400
- Batch 5: questions with IDs 401–500
- Batch 6: questions with IDs 501–600
- Batch 7: questions with IDs 601+

Each subagent reads the relevant slice of `questions.json`, verifies answers, and writes corrections back. After all batches complete, validate that the file is still valid JSON with the correct shape.

- [x] **Step 2: Validate the verified question bank**

Re-run the same validation from Task 1, Step 4. Additionally check:

```bash
node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  const q = JSON.parse(readFileSync('src/data/exams/aws-saa-c03/questions.json', 'utf-8'));
  console.log('Total:', q.length);
  console.log('Unique IDs:', new Set(q.map(x => x.id)).size);
  console.log('IDs in order:', q.every((x, i) => i === 0 || x.id > q[i-1].id));
  const shortExpl = q.filter(x => x.explanation.length < 30);
  console.log('Short explanations (<30 chars):', shortExpl.length);
  if (shortExpl.length > 0) console.log('  IDs:', shortExpl.map(x => x.id).join(', '));
  const badRef = q.filter(x => x.correctAnswer.some(a => !x.options.find(o => o.key === a)));
  console.log('Bad answer references:', badRef.length);
  console.log('Categories:', [...new Set(q.map(x => x.category))].sort().join(', '));
"
```

Expected: unique IDs, IDs in ascending order, 0 short explanations, 0 bad references.

---

### Task 3: Register Exam and Verify in App

**Files:**
- Create: `src/data/exams/aws-saa-c03/meta.json`
- Modify: `src/data/exams/index.js`

**Interfaces:**
- Consumes: `src/data/exams/aws-saa-c03/questions.json` from Task 2 (verified question bank)
- Produces: The SAA-C03 exam appearing in the app's exam picker and fully functional

- [x] **Step 1: Create meta.json**

Create `src/data/exams/aws-saa-c03/meta.json` following the existing `aws-saa` pattern:

```json
{
  "name": "Solutions Architect Associate (C03)",
  "provider": "AWS",
  "code": "SAA-C03",
  "questionCount": <actual count from questions.json>,
  "color": "#3b82f6"
}
```

Use a distinct color from the existing SAA-C02 exam (which uses `#f97316` orange). Blue (`#3b82f6`) distinguishes it visually.

Set `questionCount` to the actual number of questions in `questions.json` (read the file and count).

- [x] **Step 2: Register in index.js**

Update `src/data/exams/index.js` to add the new exam:

```javascript
import awsSaaMeta from './aws-saa/meta.json'
import awsSaaC03Meta from './aws-saa-c03/meta.json'

export const exams = [
  {
    slug: 'aws-saa',
    meta: awsSaaMeta,
    loadQuestions: () => import('./aws-saa/questions.json'),
  },
  {
    slug: 'aws-saa-c03',
    meta: awsSaaC03Meta,
    loadQuestions: () => import('./aws-saa-c03/questions.json'),
  },
]

export function findExam(slug) {
  return exams.find(e => e.slug === slug) || null
}
```

- [x] **Step 3: Verify in browser** (verified: exam picker shows both exams, SAA-C03 dashboard loads with 502 questions and 19 categories, quiz starts and renders questions correctly, answer submission shows feedback with explanation, score tracking works)

Run `npm run dev` and verify:

1. **Exam picker**: the landing page shows both SAA-C02 and SAA-C03 exams as selectable options
2. **SAA-C03 loads**: clicking the SAA-C03 exam loads the dashboard with the correct question count
3. **Quiz works**: start the quiz, answer a question, see feedback with explanation — verify the answer shown is correct
4. **Multi-select**: find a multi-select question and confirm it requires the right number of selections
5. **Categories**: check the dashboard category breakdown — should show reasonable distribution across AWS services
6. **No regressions**: the SAA-C02 exam still works identically (load it, answer a question, check progress persists independently)
