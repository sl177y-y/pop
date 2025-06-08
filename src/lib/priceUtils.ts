/**
 * Price conversion utilities for converting APT to USD
 */

// APT to USD conversion rate
const APT_TO_USD_RATE = 5;

/**
 * Converts APT price to USD and removes decimal places
 * @param aptPrice The price in APT
 * @returns The price in USD as a whole number (no decimals)
 */
export function convertAptToUsd(aptPrice: number): number {
  const usdPrice = aptPrice * APT_TO_USD_RATE;
  return Math.floor(usdPrice); // Remove decimal places by flooring
}

/**
 * Formats USD price for display with proper formatting
 * @param usdPrice The price in USD
 * @returns Formatted USD price string with commas
 */
export function formatUsdPrice(usdPrice: number): string {
  return usdPrice.toLocaleString();
}

/**
 * Converts APT to USD and formats for display
 * @param aptPrice The price in APT
 * @returns Formatted USD price string (e.g., "1,234")
 */
export function convertAndFormatAptToUsd(aptPrice: number): string {
  const usdPrice = convertAptToUsd(aptPrice);
  return formatUsdPrice(usdPrice);
} 
