// ===== IMPORT PRODUCTS =====
import { PRODUCTS } from "./temp.js";

// ===== MAIN FUNCTION =====
export function findMatchingProducts(userMessage) {
  const msg = userMessage.toLowerCase();

  // Score each product based on keyword matches
  const scoredProducts = PRODUCTS.map(product => {
    let score = 0;

    // Match problems
     product.problems.forEach(problem => {
      if (msg.includes(problem.toLowerCase())) {
        score += 2; // strong match
      }
    });

    // Match category (optional but powerful)
    if (product.category && msg.includes(product.category.toLowerCase())) {
      score += 1;
    }

    return {
      ...product,
      score
    };
  });

  // Sort by best match
  const sorted = scoredProducts
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top 3 matches
  if (sorted.length > 0) {
    return sorted.sort(() => 0.5 - Math.random()).slice(0, 1);
  }

  // ===== FALLBACK (VERY IMPORTANT) =====
  return getFallbackProducts(msg);
}

// ===== FALLBACK LOGIC =====
function getFallbackProducts(msg) {

  // MONEY / LIFE STUCK
  if (
    msg.includes("money") ||
    msg.includes("broke") ||
    msg.includes("poor") ||
    msg.includes("financial")
  ) {
    return PRODUCTS.filter(p => p.category === "wealth_mindset").slice(0, 2);
  }

  // DISCIPLINE
  if (
    msg.includes("discipline") ||
    msg.includes("lazy") ||
    msg.includes("procrastination")
  ) {
    return PRODUCTS.filter(p => p.category === "discipline").slice(0, 2);
  }

  // MIND / OVERTHINKING
  if (
    msg.includes("overthinking") ||
    msg.includes("stress") ||
    msg.includes("anxiety")
  ) {
    return PRODUCTS.filter(p => p.category === "mental_reset").slice(0, 2);
  }

  // RELATIONSHIPS
  if (
    msg.includes("dating") ||
    msg.includes("women") ||
    msg.includes("relationship")
  ) {
    return PRODUCTS.filter(p => p.category === "relationships_self_mastery").slice(0, 2);
  }

  // GENERAL / UNSURE USER
  if (
    msg.includes("book") ||
    msg.includes("read") ||
    msg.includes("help") ||
    msg.includes("life")
  ) {
    return PRODUCTS
      .filter(p =>
        p.name.toLowerCase().includes("truth") ||
        p.name.toLowerCase().includes("inner")
      )
      .slice(0, 2);
  }

  // DEFAULT (always return something)
  return PRODUCTS.slice(0, 2);
}
