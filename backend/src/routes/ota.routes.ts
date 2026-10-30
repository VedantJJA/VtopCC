import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const otaRouter = Router();

// Candidate directories to search for OTA artifacts
function getOtaDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../ota'),
    path.resolve(process.cwd(), 'ota'),
    path.resolve(process.cwd(), '../apk'),
    path.resolve(process.cwd(), 'apk')
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Fallback to backend/ota (create if missing)
  const defaultDir = path.resolve(__dirname, '../../ota');
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch (_e) {}
  return defaultDir;
}

const DEFAULT_MANIFEST = {
  version: '1.0.1',
  url: 'https://vtopcc.klouds.online/api/ota/bundle-1.0.1.zip'
};

/**
 * GET /version.json
 * Returns current OTA update version manifest as JSON
 */
otaRouter.get('/version.json', (_req, res) => {
  const otaDir = getOtaDir();
  const manifestPath = path.join(otaDir, 'version.json');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (fs.existsSync(manifestPath)) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      const parsed = JSON.parse(content);
      return res.status(200).json(parsed);
    } catch (err) {
      console.warn('[OTA Route] Error reading version.json from disk, returning default:', err);
    }
  }

  return res.status(200).json(DEFAULT_MANIFEST);
});

/**
 * GET /:filename
 * Serves requested OTA zip bundle
 */
otaRouter.get('/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const otaDir = getOtaDir();
  const filePath = path.join(otaDir, safeFilename);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(filePath);
  }

  // Try fallback to bundle.zip
  const fallbackBundle = path.join(otaDir, 'bundle.zip');
  if (fs.existsSync(fallbackBundle)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(fallbackBundle);
  }

  return res.status(404).json({
    status: 'error',
    message: `OTA bundle '${safeFilename}' not found on backend server.`
  });
});

export default otaRouter;

