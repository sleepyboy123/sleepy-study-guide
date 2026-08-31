import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PDF_FILES = [
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_1_200.pdf'), offset: 0 },
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_201_400.pdf'), offset: 200 },
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_401_574.pdf'), offset: 400 },
];

function extractText(pdfPath) {
  return execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
}

function isJunkLine(line) {
  return /^\d+\/\d+$/.test(line.trim())
    || /^\d+\/\d+\/\d+,/.test(line.trim())
    || /^https:\/\/www\.examtopics\.com/.test(line.trim())
    || /^Topic \d+$/.test(line.trim())
    || /^AWS Certified Solutions Architect/.test(line.trim())
    || /^EXAMTOPICS$/i.test(line.trim())
    || /^- Expert Verified/.test(line.trim())
    || /^Custom View Settings$/.test(line.trim());
}

function parseQuestions(text, offset) {
  const blocks = [];
  const parts = text.split(/^Question #(\d+)/m);
  // parts: [preamble, num1, block1, num2, block2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const numStr = parts[i].replace(/Topic.*$/, '').trim();
    const num = parseInt(numStr, 10);
    if (isNaN(num)) continue;
    blocks.push({ localNum: num, raw: parts[i + 1] });
  }
  return blocks.map(({ localNum, raw }) => parseOneQuestion(raw, localNum + offset));
}

function parseOneQuestion(raw, globalId) {
  const lines = raw.split('\n');
  let questionLines = [];
  let options = [];
  let currentOption = null;
  let listedAnswer = null;
  let communityVote = null;
  let communityVotePercent = null;
  let phase = 'question'; // question -> options -> answer -> community
  let communityCorrection = false;
  let communitySection = [];

  for (const line of lines) {
    if (isJunkLine(line)) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (phase === 'question') {
      const optMatch = trimmed.match(/^([A-E])\.\s+(.+)/);
      if (optMatch) {
        phase = 'options';
        currentOption = { key: optMatch[1], text: optMatch[2] };
        continue; // prevent fallthrough into options block on same iteration
      } else {
        questionLines.push(trimmed);
      }
      continue;
    }

    if (phase === 'options') {
      const answerMatch = trimmed.match(/^Correct Answer:\s*([A-E]+)/);
      if (answerMatch) {
        if (currentOption) options.push(currentOption);
        listedAnswer = answerMatch[1].split('');
        phase = 'community';
        continue;
      }
      const optMatch = trimmed.match(/^([A-E])\.\s+(.+)/);
      if (optMatch) {
        if (currentOption) options.push(currentOption);
        currentOption = { key: optMatch[1], text: optMatch[2] };
      } else if (currentOption && phase === 'options') {
        currentOption.text += ' ' + trimmed;
      }
    }

    if (phase === 'community') {
      communitySection.push(trimmed);
      const voteMatch = trimmed.match(/^\s*([A-E]+)\s*\((\d+)%\)/);
      if (voteMatch && !communityVote) {
        communityVote = [voteMatch[1]];
        communityVotePercent = [parseInt(voteMatch[2], 10)];
      } else if (voteMatch && communityVote) {
        communityVote.push(voteMatch[1]);
        communityVotePercent.push(parseInt(voteMatch[2], 10));
      }
    }
  }

  // Check for community correction
  const communityText = communitySection.join('\n');
  const correctionMatch = communityText.match(/(?:The correct question|the actual question)[:\s]*\n?([\s\S]*?)(?=\n(?:Which|What|How|upvoted|\n[A-E]\.))/i);
  let questionText = questionLines.join(' ');
  if (correctionMatch) {
    const corrected = correctionMatch[1].trim();
    if (corrected.length > 30) {
      questionText = corrected;
      communityCorrection = true;
    }
  }

  const isMultiSelect = /select two|choose two|select three/i.test(questionText)
    || (listedAnswer && listedAnswer.length > 1);

  // Auto-assign correctAnswer and confidence
  let correctAnswer;
  let confidence;
  if (communityVote && communityVotePercent) {
    correctAnswer = communityVote[0].split('');
    if (communityVotePercent[0] >= 90) confidence = 'high';
    else if (communityVotePercent[0] >= 70) confidence = 'medium';
    else confidence = 'needs-review';
  } else {
    correctAnswer = listedAnswer || [];
    confidence = 'needs-review';
  }

  return {
    id: globalId,
    question: questionText,
    options,
    listedAnswer: listedAnswer || [],
    correctAnswer,
    communityVote: communityVote || null,
    communityVotePercent: communityVotePercent || null,
    isMultiSelect,
    confidence,
    communityCorrection,
  };
}

// Main
const rawQuestions = [];
for (const { path, offset } of PDF_FILES) {
  const text = extractText(path);
  const questions = parseQuestions(text, offset);
  rawQuestions.push(...questions);
}

// Dedup by ID - keep first occurrence per global ID
const seenIds = new Set();
const allQuestions = [];
for (const q of rawQuestions) {
  if (!seenIds.has(q.id)) {
    seenIds.add(q.id);
    allQuestions.push(q);
  }
}
allQuestions.sort((a, b) => a.id - b.id);

mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });
writeFileSync(
  join(ROOT, 'src', 'data', 'questions-raw.json'),
  JSON.stringify(allQuestions, null, 2)
);

// Summary
const multi = allQuestions.filter(q => q.isMultiSelect).length;
const high = allQuestions.filter(q => q.confidence === 'high').length;
const med = allQuestions.filter(q => q.confidence === 'medium').length;
const review = allQuestions.filter(q => q.confidence === 'needs-review').length;
const corrections = allQuestions.filter(q => q.communityCorrection).length;

console.log(`Parsed: ${allQuestions.length} questions (${allQuestions.length - multi} single-select, ${multi} multi-select)`);
console.log(`Confidence: ${high} high, ${med} medium, ${review} needs-review`);
console.log(`Community corrections applied: ${corrections}`);
