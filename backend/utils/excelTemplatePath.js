import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, '..', 'templates');

export const resolveExcelTemplatePath = (templateFile) => {
  const templatePath = path.join(templatesDir, templateFile);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing Excel template: ${templateFile} (expected at ${templatePath})`);
  }

  return templatePath;
};
