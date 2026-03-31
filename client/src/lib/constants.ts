// Shared constants used across item-related pages

export const CATEGORIES = [
  "Produce", "Dairy", "Meat", "Bakery", "Frozen",
  "Beverages", "Snacks", "Pantry", "Household", "Other"
];

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Produce: "Fruits, vegetables, herbs",
  Dairy: "Milk, cheese, yogurt, eggs, butter",
  Meat: "Beef, chicken, pork, fish, deli",
  Bakery: "Bread, rolls, tortillas, pastries",
  Frozen: "Frozen meals, pizza, ice cream, veggies",
  Beverages: "Water, juice, soda, coffee, tea",
  Snacks: "Chips, crackers, cookies, nuts, bars",
  Pantry: "Cereal, pasta, rice, canned goods, oils",
  Household: "Cleaning, paper goods, bags, soap",
  Other: "Anything else",
};

export const unitLabels: Record<string, string> = {
  "fl oz": "Fluid Ounces (fl oz)",
  "oz": "Ounces (oz)",
  "lb": "Pounds (lb)",
  "ct": "Count (ct)",
  "gal": "Gallons (gal)",
  "L": "Liters (L)",
};
