import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CATEGORY_PATTERNS = [
  { category: 'S3', patterns: [/\bS3\b/, /\bsimple storage/i, /\bbucket[s]?\b/i, /\bobject storage/i] },
  { category: 'RDS', patterns: [/\bRDS\b/, /\bAurora\b/, /\brelational database/i, /\bMulti-AZ\b/i, /\bread replica/i] },
  { category: 'VPC', patterns: [/\bVPC\b/, /\bsubnet[s]?\b/i, /\bsecurity group/i, /\bNACL\b/, /\binternet gateway/i, /\bNAT gateway/i, /\broute table/i] },
  { category: 'IAM', patterns: [/\bIAM\b/, /\brole[s]?\b/i, /\bpolic(?:y|ies)\b/i, /\bcross.?account/i, /\bSTS\b/, /\bfederat/i] },
  { category: 'Lambda', patterns: [/\bLambda\b/, /\bserverless\b/i, /\bfunction[s]?\b/i] },
  { category: 'DynamoDB', patterns: [/\bDynamoDB\b/, /\bNoSQL\b/i, /\bpartition key/i, /\bsort key/i] },
  { category: 'CloudFront', patterns: [/\bCloudFront\b/, /\bCDN\b/, /\bedge location/i, /\bdistribution\b/i] },
  { category: 'ELB', patterns: [/\bload balancer/i, /\bALB\b/, /\bNLB\b/, /\bELB\b/, /\btarget group/i] },
  { category: 'SQS/SNS', patterns: [/\bSQS\b/, /\bSNS\b/, /\bqueue\b/i, /\bmessag(?:e|ing)\b/i, /\bdecouple/i] },
  { category: 'ECS/EKS', patterns: [/\bECS\b/, /\bEKS\b/, /\bFargate\b/, /\bcontainer[s]?\b/i, /\bKubernetes\b/i] },
  { category: 'CloudWatch', patterns: [/\bCloudWatch\b/, /\bmonitoring\b/i, /\balarm[s]?\b/i, /\blog group/i] },
  { category: 'Route 53', patterns: [/\bRoute\s*53\b/, /\bDNS\b/i, /\bhosted zone/i, /\brouting policy/i] },
  { category: 'KMS/Security', patterns: [/\bKMS\b/, /\bencrypt/i, /\bSSE\b/, /\bACM\b/, /\bWAF\b/, /\bShield\b/, /\bGuardDuty\b/, /\bMacie\b/] },
  { category: 'Storage', patterns: [/\bEBS\b/, /\bEFS\b/, /\bFSx\b/, /\bStorage Gateway\b/i, /\bSnowball\b/i, /\bGlacier\b/i] },
  { category: 'Database', patterns: [/\bElastiCache\b/, /\bRedshift\b/, /\bNeptune\b/, /\bDocumentDB\b/, /\bMemoryDB\b/] },
  { category: 'Analytics', patterns: [/\bAthena\b/, /\bKinesis\b/, /\bEMR\b/, /\bGlue\b/, /\bQuickSight\b/, /\bOpenSearch\b/] },
  { category: 'Migration', patterns: [/\bDMS\b/, /\bDatabase Migration/i, /\bServer Migration/i, /\bDataSync\b/, /\bTransfer Family/i] },
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

const SKIP_IDS = new Set([377, 566, 571]);

const raw = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'questions-raw.json'), 'utf-8'));

// Load existing questions.json to preserve hand-written explanations
let existingExplanations = {};
try {
  const existing = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'questions.json'), 'utf-8'));
  existing.forEach(q => { existingExplanations[q.id] = q.explanation; });
} catch {
  // no existing file - start fresh
}

const questions = raw
  .filter(q => !SKIP_IDS.has(q.id))
  .map(q => ({
  id: q.id,
  question: q.question,
  options: q.options,
  correctAnswer: q.correctAnswer,
  explanation: existingExplanations[q.id] || '[Explanation pending verification]',
  isMultiSelect: q.isMultiSelect,
  confidence: q.confidence,
  category: assignCategory(q),
  communityCorrection: q.communityCorrection,
}));

writeFileSync(join(ROOT, 'src', 'data', 'questions.json'), JSON.stringify(questions, null, 2));

// Print stats
const cats = {};
questions.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
console.log('\nCategory distribution:');
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

const needsReview = questions.filter(q => q.confidence === 'needs-review');
console.log(`\nNeeds review (${needsReview.length}): ${needsReview.map(q => q.id).join(', ')}`);
