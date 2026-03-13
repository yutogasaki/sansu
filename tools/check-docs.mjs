import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const statusDocs = [
  "docs/10_design_refresh_status.md",
  "docs/11_full_task_backlog.md",
  "docs/12_ui_fix_tasklist.md",
];
const adrRequiredPatterns = [
  { label: "Date", pattern: /^- Date:\s*.+$/m },
  { label: "Status", pattern: /^- Status:\s*.+$/m },
  { label: "Related spec", pattern: /^- Related spec:\s*.*$/m },
  { label: "Related task", pattern: /^- Related task:\s*.*$/m },
  { label: "Context", pattern: /^## Context$/m },
  { label: "Decision", pattern: /^## Decision$/m },
  { label: "Alternatives Considered", pattern: /^## Alternatives Considered$/m },
  { label: "Consequences", pattern: /^## Consequences$/m },
  { label: "Verification", pattern: /^## Verification$/m },
];
const activeTaskFilenamePattern = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const doneLogFilenamePattern = /^\d{4}-\d{2}\.md$/;

const activeTaskRequiredPatterns = [
  { label: "Review By", pattern: /^- Review By:/m },
  { label: "Docs To Touch", pattern: /^## Docs To Touch$/m },
  { label: "Verification", pattern: /^## Verification$/m },
];

const isExternalLink = (href) =>
  href.startsWith("http://") ||
  href.startsWith("https://") ||
  href.startsWith("mailto:") ||
  href.startsWith("tel:");

const stripHash = (href) => href.split("#", 1)[0];

const collectMarkdownFiles = async (startPath) => {
  const absolutePath = path.join(repoRoot, startPath);
  const stat = await fs.stat(absolutePath);

  if (stat.isFile()) return [startPath];

  const results = [];
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectMarkdownFiles(relativePath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relativePath);
    }
  }

  return results.sort();
};

const extractLinks = (content) => {
  const links = [];
  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawHref = match[1].trim();
    const href = rawHref.split(/\s+"/, 1)[0];
    links.push(href);
  }
  return links;
};

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const checkMarkdownLinks = async (relativeFilePath, errors) => {
  const absoluteFilePath = path.join(repoRoot, relativeFilePath);
  const content = await fs.readFile(absoluteFilePath, "utf8");
  const links = extractLinks(content);

  for (const href of links) {
    if (!href || href.startsWith("#") || isExternalLink(href)) continue;

    const cleanHref = stripHash(href);
    if (!cleanHref) continue;

    const resolvedPath = href.startsWith("/")
      ? path.join(repoRoot, cleanHref.slice(1))
      : path.resolve(path.dirname(absoluteFilePath), cleanHref);

    if (!(await fileExists(resolvedPath))) {
      errors.push(`${relativeFilePath}: broken local link -> ${href}`);
    }
  }
};

const checkStatusDocs = async (errors, warnings) => {
  const today = new Date().toISOString().slice(0, 10);

  for (const relativeFilePath of statusDocs) {
    const absoluteFilePath = path.join(repoRoot, relativeFilePath);
    const content = await fs.readFile(absoluteFilePath, "utf8");

    if (!/^更新日:\s*\d{4}-\d{2}-\d{2}$/m.test(content)) {
      errors.push(`${relativeFilePath}: missing or invalid 更新日`);
    }

    const reviewByMatch = content.match(/^次回棚卸し目安:\s*(\d{4}-\d{2}-\d{2})$/m);
    if (!reviewByMatch) {
      errors.push(`${relativeFilePath}: missing or invalid 次回棚卸し目安`);
      continue;
    }

    if (reviewByMatch[1] < today) {
      warnings.push(`${relativeFilePath}: 次回棚卸し目安 (${reviewByMatch[1]}) is in the past`);
    }
  }
};

const checkActiveTaskFiles = async (errors, warnings) => {
  const activeTaskDir = path.join(repoRoot, "docs/tasks/active");
  const entries = await fs.readdir(activeTaskDir, { withFileTypes: true });
  const today = new Date().toISOString().slice(0, 10);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "README.md" || entry.name === "TEMPLATE.md") continue;

    if (!activeTaskFilenamePattern.test(entry.name)) {
      errors.push(`docs/tasks/active/${entry.name}: filename must match YYYY-MM-DD-short-task-name.md`);
    }

    const relativeFilePath = path.join("docs/tasks/active", entry.name);
    const content = await fs.readFile(path.join(repoRoot, relativeFilePath), "utf8");

    for (const requirement of activeTaskRequiredPatterns) {
      if (!requirement.pattern.test(content)) {
        errors.push(`${relativeFilePath}: missing required section -> ${requirement.label}`);
      }
    }

    const reviewByMatch = content.match(/^- Review By:\s*(\d{4}-\d{2}-\d{2})$/m);
    if (!reviewByMatch) {
      errors.push(`${relativeFilePath}: missing or invalid Review By date`);
      continue;
    }

    if (reviewByMatch[1] < today) {
      warnings.push(`${relativeFilePath}: Review By (${reviewByMatch[1]}) is in the past`);
    }
  }
};

const checkAdrFiles = async (errors) => {
  const adrFiles = await collectMarkdownFiles("docs/adr");

  for (const relativeFilePath of adrFiles) {
    const basename = path.basename(relativeFilePath);
    if (basename === "README.md" || basename === "0000-template.md") continue;

    if (!activeTaskFilenamePattern.test(basename)) {
      errors.push(`${relativeFilePath}: filename must match YYYY-MM-DD-short-title.md`);
    }

    const content = await fs.readFile(path.join(repoRoot, relativeFilePath), "utf8");
    for (const requirement of adrRequiredPatterns) {
      if (!requirement.pattern.test(content)) {
        errors.push(`${relativeFilePath}: missing required section -> ${requirement.label}`);
      }
    }
  }
};

const checkDoneLogs = async (errors) => {
  const doneFiles = await collectMarkdownFiles("docs/done");

  for (const relativeFilePath of doneFiles) {
    const basename = path.basename(relativeFilePath);
    if (basename === "README.md" || basename === "TEMPLATE.md") continue;
    if (!doneLogFilenamePattern.test(basename)) {
      errors.push(`${relativeFilePath}: filename must match YYYY-MM.md`);
    }
  }
};

const checkRunbookIndex = async (errors) => {
  const indexPath = path.join(repoRoot, "docs/runbooks/README.md");
  const indexContent = await fs.readFile(indexPath, "utf8");
  const indexedFiles = new Set(
    extractLinks(indexContent)
      .map((href) => stripHash(href))
      .filter((href) => href.endsWith(".md"))
      .map((href) => path.basename(href))
  );

  const runbookFiles = await collectMarkdownFiles("docs/runbooks");
  for (const relativeFilePath of runbookFiles) {
    const basename = path.basename(relativeFilePath);
    if (basename === "README.md") continue;
    if (!indexedFiles.has(basename)) {
      errors.push(`docs/runbooks/README.md: missing runbook entry -> ${basename}`);
    }
  }
};

const main = async () => {
  const errors = [];
  const warnings = [];
  const markdownFiles = [
    "CONSTITUTION.md",
    ...(await collectMarkdownFiles("docs")),
  ];

  for (const relativeFilePath of markdownFiles) {
    await checkMarkdownLinks(relativeFilePath, errors);
  }

  await checkStatusDocs(errors, warnings);
  await checkActiveTaskFiles(errors, warnings);
  await checkAdrFiles(errors);
  await checkDoneLogs(errors);
  await checkRunbookIndex(errors);

  if (warnings.length > 0) {
    console.log("WARN");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("PASS docs:check");
};

main().catch((error) => {
  console.error("FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
