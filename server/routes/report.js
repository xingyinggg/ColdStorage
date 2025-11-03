import express from 'express';
import puppeteer from 'puppeteer';

const router = express.Router();

router.post('/generate-pdf', async (req, res) => {
  try {
    const { html, filename, title } = req.body;
    
    if (!html || !filename || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('Starting PDF generation for:', title);
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport BEFORE loading content
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });
    
    // Create full HTML document with Tailwind CDN
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * {
              box-sizing: border-box;
            }
            
            body { 
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              background: white;
              margin: 0;
            }
            
            /* Force grid to stay in single row */
            .grid-cols-4 {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }
            
            /* Prevent breaking inside cards */
            .avoid-break-inside {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            
            .border.rounded-lg {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${title}</h1>
            <p style="font-size: 14px; color: #6b7280; margin-top: 5px;">
              Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </p>
          </div>
          ${html}
        </body>
      </html>
    `;
    
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // CRITICAL: Wait for Tailwind CSS to load and apply styles
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify styles are applied by checking computed styles
    const hasStyles = await page.evaluate(() => {
      const testEl = document.querySelector('.text-gray-900, .bg-white, .shadow');
      if (!testEl) return false;
      const styles = window.getComputedStyle(testEl);
      return styles.length > 0;
    });
    
    console.log('Styles loaded:', hasStyles);
    
    // Generate PDF with optimized settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false,
    });
    
    await browser.close();
    
    console.log('PDF generated successfully');
    
    // Return PDF as buffer
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message 
    });
  }
});

/* istanbul ignore next */
export default router;
