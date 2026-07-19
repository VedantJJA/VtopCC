import app from './app';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`[Server] VtopC backend listening on port ${port}`);

  // Keep-alive keepawake job for Render free tier deployment
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    const intervalMs = 10 * 60 * 1000; // 10 minutes
    setInterval(async () => {
      try {
        const pingUrl = `${selfUrl.replace(/\/$/, '')}/health`;
        console.log(`[Ping] Sending keep-alive request to ${pingUrl}`);
        const response = await axios.get(pingUrl);
        console.log(`[Ping] Keep-alive status: ${response.data.status}`);
      } catch (error: any) {
        console.error('[Ping] Keep-alive failed:', error.message || error);
      }
    }, intervalMs);
    console.log(`[Ping] Keepawake job initialized for: ${selfUrl}`);
  }
});
