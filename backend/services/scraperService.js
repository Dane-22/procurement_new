// backend/services/scraperService.js
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrapes product variants based on generic item data.
 * Note: Since no specific target source was provided, this service currently
 * provides a mock implementation that returns plausible sizes based on the category.
 * To integrate a real web scraper, replace the mock logic with axios/cheerio calls 
 * to a specific catalog or use a product search API like SerpApi.
 */
export const scrapeVariants = async (itemName, category, description, unit) => {
  try {
    const variants = [];
    const baseCode = itemName.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    // Build search query based on inputs
    const query = `${itemName} sizes ${unit || ''} specifications`;
    
    // Scrape DuckDuckGo Lite for search results (as it doesn't heavily block automated requests)
    const { data } = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(data);
    const text = $('.result-snippet').text();

    // Regex to find things like "20mm", "20 mm", "1.5 inch", "1/2 inch", "16 oz", "16d", "#4", "10M" etc.
    const sizeRegex = new RegExp(`\\b#?\\d+(?:[.\\/]\\d+)?\\s*(?:mm|cm|m|inch|inches|"|oz|kg|lbs|g|L|ml|pcs|gallons|gallon|d|M)\\b`, 'gi');
    let sizes = text.match(sizeRegex);

    if (sizes && sizes.length > 0) {
      // Clean up and deduplicate sizes, removing any standalone numbers that matched incorrectly
      sizes = [...new Set(sizes.map(s => s.trim().toLowerCase()))].filter(s => /[a-z"M]/i.test(s));
      
      // Limit to max 10 variants to avoid overwhelming the UI
      sizes.slice(0, 10).forEach((size, index) => {
        variants.push({
          item_code: `${baseCode}-${index + 1}`,
          item_name: `${itemName} - ${size}`,
          description: `${description ? description + ' ' : ''}(Size: ${size})`,
          category,
          unit: unit || 'pcs',
          reorder_level: 10,
          unit_price: Math.floor(Math.random() * 50) + 10
        });
      });
    }

    // Fallback if the search didn't yield any clear sizes
    if (variants.length === 0) {
      let defaultSizes = ['Small', 'Medium', 'Large', 'Standard'];
      
      // Smart fallbacks for common hardware that might fail a generic search
      const nameLower = itemName.toLowerCase();
      if (nameLower.includes('nail')) {
        defaultSizes = ['2d (1 inch)', '4d (1-1/2 inch)', '6d (2 inch)', '8d (2-1/2 inch)', '16d (3-1/2 inch)'];
      } else if (nameLower.includes('screw')) {
        defaultSizes = ['1/2 inch', '3/4 inch', '1 inch', '1-1/2 inch', '2 inch'];
      } else if (nameLower.includes('wire')) {
        defaultSizes = ['10 AWG', '12 AWG', '14 AWG', '16 AWG'];
      }
      
      defaultSizes.forEach((size, index) => {
        variants.push({
          item_code: `${baseCode}-${index + 1}`,
          item_name: `${itemName} - ${size}`,
          description: `${description ? description + ' ' : ''}(${size})`,
          category,
          unit: unit || 'pcs',
          reorder_level: 10,
          unit_price: Math.floor(Math.random() * 50) + 10
        });
      });
    }

    return variants;
  } catch (error) {
    console.error('Error scraping variants:', error);
    throw error;
  }
};
