import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
  const text = question.question;
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(text))) return category;
  }
  return 'Other';
}

function truncateAtSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastPeriod = cut.lastIndexOf('. ');
  if (lastPeriod > maxLen * 0.5) return cut.substring(0, lastPeriod + 1);
  return cut.trimEnd();
}

// ── Solution file parser ──

function parseSolutionFile(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const solutions = new Map();

  const parts = text.split(/^(\d+)\]/m);

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
        const ansMatch = line.match(/^ans[-–]\s*(.+)/i);
        if (ansMatch) {
          answerText = ansMatch[1].trim();
          foundAnswer = true;
          continue;
        }
        const answerLine = line.match(/^Answers?:\s*([A-F])\)?[.)]\s*(.*)/i);
        if (answerLine) {
          answerLetters.push(answerLine[1]);
          answerText = answerLine[2] || '';
          const extras = line.matchAll(/\+\s*([A-F])\)/g);
          for (const ex of extras) answerLetters.push(ex[1]);
          foundAnswer = true;
          continue;
        }
        const letterMatch = line.match(/^([A-F])[.)]\s+(.+)/);
        if (letterMatch) {
          answerLetters.push(letterMatch[1]);
          answerText = letterMatch[2].trim();
          foundAnswer = true;
          continue;
        }
      } else {
        const additionalLetter = line.match(/^([A-F])[.)]\s+(.+)/);
        if (additionalLetter && answerLetters.length > 0) {
          answerLetters.push(additionalLetter[1]);
          continue;
        }
        explanationLines.push(line);
      }
    }

    if (!answerText && answerLetters.length === 0) continue;

    solutions.set(num, {
      answerLetters,
      answerText,
      explanation: truncateAtSentence(explanationLines.join(' ').trim(), 800) || answerText,
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

  // pdf-parse can't decode PDF ligatures (fi, fl, ff, ffi, ffl) and emits NUL instead.
  // Default to "fi" (most common). Use "fl" only when the following chars match known "fl" patterns.
  const nulCount = (text.match(/\u0000/g) || []).length;
  const flPattern = /^\u0000(?=ow|ag|at|eet|ex|oat|uct|ush|ight|ood|oor|ip|unk|oat|uc|uen)/;
  const cleaned = text.replace(/\u0000/g, (match, offset) => {
    const after = text.substring(offset, offset + 6);
    return flPattern.test(after) ? 'fl' : 'fi';
  });
  if (nulCount > 0) console.log(`Replaced ${nulCount} NUL characters (context-aware ligature repair)`);

  const questions = [];

  // PDF format: "Topic NQuestion #N" (no space) or "Question #N"
  let parts = cleaned.split(/(?:Topic\s+\d+)?Question\s+#(\d+)/i);

  if (parts.length < 20) {
    console.log(`"Question N" pattern found only ${Math.floor(parts.length / 2)} questions, trying fallback...`);
    parts = cleaned.split(/\n(\d+)\.\s+(?=[A-Z])/);
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
      if (/(?:Topic\s+\d+)?Question\s+#?\d+/i.test(trimmed)) break;

      const optMatch = trimmed.match(/^([A-F])[.)]\s+(.+)/);
      if (optMatch) {
        if (phase === 'question') phase = 'options';
        if (currentOption) options.push(currentOption);
        currentOption = { key: optMatch[1], text: optMatch[2] };
      } else if (phase === 'question') {
        questionLines.push(trimmed);
      } else if (currentOption && phase === 'options') {
        currentOption.text += ' ' + trimmed;
      }
    }
    if (currentOption) options.push(currentOption);

    const questionText = questionLines.join(' ').trim();

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

    const chooseMatch = pq.question.match(/(?:select|choose)\s+(two|three|2|3)/i);
    const expectedCount = chooseMatch
      ? ({ two: 2, three: 3, '2': 2, '3': 3 }[chooseMatch[1].toLowerCase()])
      : null;

    if (!sol) {
      warnings.push(`Q${pq.num}: no solution entry found — needs answer`);
      const isMultiSelect = expectedCount ? expectedCount > 1 : false;
      results.push({
        id: pq.num,
        question: pq.question,
        options: pq.options,
        correctAnswer: ['?'],
        explanation: '',
        isMultiSelect,
        needsAnswer: true,
        category: assignCategory({ question: pq.question }),
      });
      continue;
    }

    let correctAnswer = [...new Set(sol.answerLetters)];

    if (correctAnswer.length === 0 && sol.answerText) {
      const needle = sol.answerText.toLowerCase().trim();
      if (needle.length < 5) {
        warnings.push(`Q${pq.num}: answer text too short for reliable matching ("${sol.answerText}") — needs answer`);
        results.push({
          id: pq.num,
          question: pq.question,
          options: pq.options,
          correctAnswer: ['?'],
          explanation: sol.explanation,
          isMultiSelect: expectedCount ? expectedCount > 1 : false,
          needsAnswer: true,
          category: assignCategory({ question: pq.question }),
        });
        continue;
      }
      const matched = pq.options.find(opt => {
        const optText = opt.text.toLowerCase();
        return optText.startsWith(needle.substring(0, 80)) || needle.startsWith(optText.substring(0, 80));
      });
      if (matched) {
        correctAnswer = [matched.key];
      } else {
        warnings.push(`Q${pq.num}: could not match answer text to any option — needs answer`);
        results.push({
          id: pq.num,
          question: pq.question,
          options: pq.options,
          correctAnswer: ['?'],
          explanation: sol.explanation,
          isMultiSelect: expectedCount ? expectedCount > 1 : false,
          needsAnswer: true,
          category: assignCategory({ question: pq.question }),
        });
        continue;
      }
    }

    const validLetters = correctAnswer.filter(l => pq.options.some(o => o.key === l));
    if (validLetters.length === 0) {
      warnings.push(`Q${pq.num}: answer ${correctAnswer.join(',')} not found in options [${pq.options.map(o => o.key).join(',')}] — needs answer`);
      results.push({
        id: pq.num,
        question: pq.question,
        options: pq.options,
        correctAnswer: ['?'],
        explanation: sol.explanation,
        isMultiSelect: expectedCount ? expectedCount > 1 : false,
        needsAnswer: true,
        category: assignCategory({ question: pq.question }),
      });
      continue;
    }

    if (expectedCount && validLetters.length !== expectedCount) {
      warnings.push(`Q${pq.num}: question asks "choose ${chooseMatch[1]}" but has ${validLetters.length} answer(s) [${validLetters.join(',')}] — needs answer`);
      results.push({
        id: pq.num,
        question: pq.question,
        options: pq.options,
        correctAnswer: ['?'],
        explanation: sol.explanation,
        isMultiSelect: expectedCount > 1,
        needsAnswer: true,
        category: assignCategory({ question: pq.question }),
      });
      continue;
    }

    const isMultiSelect = expectedCount ? expectedCount > 1 : validLetters.length > 1;

    results.push({
      id: pq.num,
      question: pq.question,
      options: pq.options,
      correctAnswer: validLetters,
      explanation: sol.explanation,
      isMultiSelect,
      category: assignCategory({ question: pq.question }),
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

  const outDir = join(ROOT, 'src', 'data', 'exams', 'aws-saa-c03');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'questions.json'), JSON.stringify(results, null, 2));

  const meta = {
    name: 'Solutions Architect Associate (C03)',
    provider: 'AWS',
    code: 'SAA-C03',
    questionCount: results.length,
    color: '#3b82f6',
  };
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  const multi = results.filter(q => q.isMultiSelect).length;
  const needs = results.filter(q => q.needsAnswer).length;
  const cats = {};
  results.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });

  console.log(`\n=== RESULTS ===`);
  console.log(`Output: ${results.length} questions (${results.length - multi} single, ${multi} multi-select)`);
  console.log(`Needs answer: ${needs} questions marked with correctAnswer=["?"]`);
  console.log(`Solution entries with no PDF match: ${solutionMap.size - results.length}`);
  console.log('\nCategory distribution:');
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n=== SPOT CHECK (first 3) ===');
  results.slice(0, 3).forEach(q => {
    console.log(`Q${q.id} [${q.category}] ${q.question.substring(0, 80)}...`);
    console.log(`  Options: ${q.options.map(o => o.key).join(', ')}`);
    console.log(`  Answer: ${q.correctAnswer.join(', ')} | Multi: ${q.isMultiSelect}`);
    console.log(`  Explanation: ${q.explanation.substring(0, 100)}...`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
