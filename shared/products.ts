/**
 * Product catalog — common grocery products with their category, default unit,
 * and relevant tags. Used for autocomplete, fuzzy search, and context-aware tag filtering.
 *
 * Each product has:
 * - name: The generic product name (what APIs will recognize)
 * - aliases: Common misspellings, brand names, or alternate names
 * - category: Which aisle it belongs to
 * - defaultUnit: How it's typically measured
 * - relevantTags: Only the tags that make sense for this specific product
 */

export interface ProductEntry {
  name: string;
  aliases: string[];
  category: string;
  defaultUnit: string;
  relevantTags: string[];
}

export const PRODUCT_CATALOG: ProductEntry[] = [
  // ===== DAIRY =====
  { name: "Milk", aliases: ["leche", "whole milk", "2 percent milk", "skim milk", "oat milk", "almond milk"],
    category: "Dairy", defaultUnit: "fl oz",
    relevantTags: ["Whole", "2%", "1%", "Skim", "Fat-Free", "Lactose-Free", "Non-Dairy", "Oat", "Almond", "Soy", "Organic", "Grass-Fed", "A2", "Raw", "Ultra-Pasteurized", "Flavored"] },
  { name: "Yogurt", aliases: ["yougrt", "yoghurt", "yougurt", "yogart", "greek yogurt"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Greek", "Low-Fat", "Non-Fat", "Whole", "Plant-Based", "Organic", "Vanilla", "Plain", "Strawberry", "Flavored"] },
  { name: "Cheese", aliases: ["queso", "cheddar", "mozzarella", "swiss", "pepper jack", "colby jack", "american cheese", "parmesan"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Shredded", "Sliced", "Block", "Cream Cheese", "String Cheese", "Organic"] },
  { name: "Eggs", aliases: ["huevos", "egg", "dozen eggs", "large eggs"],
    category: "Dairy", defaultUnit: "ct",
    relevantTags: ["Conventional", "Cage-Free", "Free-Range", "Pasture-Raised", "Organic", "Brown", "Large", "Extra Large"] },
  { name: "Butter", aliases: ["mantequilla", "margarine"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Salted", "Unsalted", "Whipped", "Organic", "Grass-Fed"] },
  { name: "Cream Cheese", aliases: ["philadelphia", "cream chese"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Regular", "Low-Fat", "Non-Fat", "Whipped", "Flavored", "Organic"] },
  { name: "Sour Cream", aliases: ["crema", "sour creme"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Regular", "Low-Fat", "Non-Fat", "Organic"] },
  { name: "Heavy Cream", aliases: ["whipping cream", "heavy whipping cream"],
    category: "Dairy", defaultUnit: "fl oz",
    relevantTags: ["Regular", "Organic"] },
  { name: "Cottage Cheese", aliases: ["cotage cheese"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Regular", "Low-Fat", "Non-Fat", "Organic"] },
  { name: "Coffee Creamer", aliases: ["creamer", "cofee creamer"],
    category: "Dairy", defaultUnit: "fl oz",
    relevantTags: ["Regular", "Non-Dairy", "Vanilla", "Flavored", "Organic"] },
  { name: "Panela Cheese", aliases: ["queso panela"],
    category: "Dairy", defaultUnit: "oz",
    relevantTags: ["Whole", "Organic"] },

  // ===== PRODUCE =====
  { name: "Bananas", aliases: ["banana", "platano", "platanos"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Apples", aliases: ["apple", "manzana", "manzanas", "gala", "fuji", "honeycrisp", "granny smith"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Oranges", aliases: ["orange", "naranja", "naranjas", "navel oranges"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Strawberries", aliases: ["strawberry", "fresa", "fresas"],
    category: "Produce", defaultUnit: "oz",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Grapes", aliases: ["grape", "uvas", "red grapes", "green grapes"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Avocados", aliases: ["avocado", "aguacate", "aguacates"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh", "Bagged"] },
  { name: "Tomatoes", aliases: ["tomato", "tomate", "tomates", "roma tomatoes", "cherry tomatoes"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh", "Baby/Mini"] },
  { name: "Onions", aliases: ["onion", "cebolla", "cebollas", "yellow onion", "red onion", "white onion"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Potatoes", aliases: ["potato", "papa", "papas", "russet potatoes", "red potatoes", "gold potatoes"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Lettuce", aliases: ["lechuga", "romaine", "iceberg lettuce"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh", "Hydroponic"] },
  { name: "Carrots", aliases: ["carrot", "zanahoria", "zanahorias", "baby carrots"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Bagged", "Baby/Mini", "Fresh"] },
  { name: "Broccoli", aliases: ["brocoli", "broccolini"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh", "Frozen"] },
  { name: "Bell Peppers", aliases: ["bell pepper", "pimiento", "pimientos", "green pepper", "red pepper"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Cilantro", aliases: ["cilanto", "coriander"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh", "Bunch"] },
  { name: "Limes", aliases: ["lime", "limon", "limones"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Lemons", aliases: ["lemon"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Bagged", "Fresh"] },
  { name: "Garlic", aliases: ["ajo"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Jalapeños", aliases: ["jalapeno", "jalapenos", "jalapeño"],
    category: "Produce", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh"] },
  { name: "Corn", aliases: ["elote", "elotes", "sweet corn", "corn on the cob"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh", "Frozen", "Canned"] },
  { name: "Spinach", aliases: ["espinaca", "espinacas", "baby spinach"],
    category: "Produce", defaultUnit: "oz",
    relevantTags: ["Conventional", "Organic", "Fresh", "Bagged", "Baby/Mini", "Frozen"] },
  { name: "Celery", aliases: ["apio"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh", "Bunch"] },
  { name: "Cucumbers", aliases: ["cucumber", "pepino", "pepinos"],
    category: "Produce", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Fresh"] },

  // ===== MEAT =====
  { name: "Chicken Breast", aliases: ["chicken brest", "chiken breast", "chiken brest", "pechuga", "pechuga de pollo"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Boneless", "Bone-In", "Conventional", "Organic", "Free-Range", "No Antibiotics"] },
  { name: "Chicken Thighs", aliases: ["chicken thigh", "muslo de pollo"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Boneless", "Bone-In", "Conventional", "Organic", "Free-Range"] },
  { name: "Whole Chicken", aliases: ["whole chiken", "pollo entero"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Free-Range", "Kosher", "Halal"] },
  { name: "Chicken Wings", aliases: ["chicken wing", "alas de pollo", "wings"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Conventional", "Organic", "Fresh", "Frozen"] },
  { name: "Ground Beef", aliases: ["ground meet", "carne molida", "hamburger meat", "ground meat"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Lean", "Ground", "Conventional", "Organic", "Grass-Fed"] },
  { name: "Steak", aliases: ["bistec", "beef steak", "ribeye", "new york strip", "sirloin", "filet mignon", "t-bone"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Steak", "Tenderloin", "Fillet", "Conventional", "Organic", "Grass-Fed"] },
  { name: "Ground Turkey", aliases: ["turkey meat", "pavo molido"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Lean", "Ground", "Conventional", "Organic"] },
  { name: "Pork Chops", aliases: ["pork chop", "chuletas", "chuleta de puerco"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Bone-In", "Boneless", "Conventional", "Organic"] },
  { name: "Bacon", aliases: ["tocino", "turkey bacon"],
    category: "Meat", defaultUnit: "oz",
    relevantTags: ["Smoked", "Uncured", "Conventional", "Organic", "No Antibiotics"] },
  { name: "Hot Dogs", aliases: ["hotdogs", "hot dog", "frankfurter", "franks", "weiners", "winnies", "wieners"],
    category: "Meat", defaultUnit: "ct",
    relevantTags: ["Conventional", "Organic", "Uncured", "No Antibiotics", "Kosher"] },
  { name: "Sausage", aliases: ["salchicha", "salchichas", "breakfast sausage", "italian sausage", "chorizo"],
    category: "Meat", defaultUnit: "oz",
    relevantTags: ["Smoked", "Conventional", "Organic", "Uncured", "Spicy"] },
  { name: "Deli Turkey", aliases: ["turkey deli", "sliced turkey", "pavo"],
    category: "Meat", defaultUnit: "oz",
    relevantTags: ["Deli-Sliced", "Smoked", "Conventional", "Organic", "No Antibiotics"] },
  { name: "Deli Ham", aliases: ["ham", "jamon", "sliced ham"],
    category: "Meat", defaultUnit: "oz",
    relevantTags: ["Deli-Sliced", "Smoked", "Conventional", "Organic", "Uncured"] },
  { name: "Salmon", aliases: ["salmon fillet", "salmon filet"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Wild-Caught", "Farm-Raised", "Fresh", "Frozen", "Fillet", "Organic"] },
  { name: "Shrimp", aliases: ["camarones", "prawns"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Wild-Caught", "Farm-Raised", "Shell-On", "Peeled", "Fresh", "Frozen"] },
  { name: "Tilapia", aliases: ["tilapia fillet"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Farm-Raised", "Fresh", "Frozen", "Fillet"] },
  { name: "Ribs", aliases: ["costillas", "baby back ribs", "spare ribs", "pork ribs"],
    category: "Meat", defaultUnit: "lb",
    relevantTags: ["Ribs", "Bone-In", "Conventional", "Organic"] },

  // ===== BAKERY =====
  { name: "Bread", aliases: ["pan", "loaf", "bread loaf", "sandwich bread"],
    category: "Bakery", defaultUnit: "oz",
    relevantTags: ["White", "Whole Wheat", "Multigrain", "Sourdough", "Rye", "Gluten-Free", "Organic", "Sliced", "Unsliced"] },
  { name: "Tortillas", aliases: ["tortilla", "tortillas de harina", "tortillas de maiz", "flour tortillas", "corn tortillas"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Tortilla", "White", "Whole Wheat", "Organic", "Gluten-Free"] },
  { name: "Bagels", aliases: ["bagel", "bagles", "bagells"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Bagel", "Whole Wheat", "Gluten-Free", "Organic", "Plain"] },
  { name: "Hamburger Buns", aliases: ["burger buns", "buns"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Bun", "White", "Whole Wheat", "Brioche", "Gluten-Free"] },
  { name: "Hot Dog Buns", aliases: ["hotdog buns"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Bun", "White", "Whole Wheat"] },
  { name: "English Muffins", aliases: ["english muffin", "engish muffins"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["English Muffin", "Whole Wheat", "Gluten-Free", "Organic"] },
  { name: "Pita Bread", aliases: ["pita"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Pita", "Whole Wheat", "White", "Gluten-Free"] },
  { name: "Croissants", aliases: ["croissant", "cruasan"],
    category: "Bakery", defaultUnit: "ct",
    relevantTags: ["Croissant", "Butter", "Organic"] },
  { name: "Raisin Bread", aliases: ["cinnamon raisin bread"],
    category: "Bakery", defaultUnit: "oz",
    relevantTags: ["Sliced", "Organic"] },

  // ===== FROZEN =====
  { name: "Frozen Pizza", aliases: ["pizza", "frozen piza"],
    category: "Frozen", defaultUnit: "oz",
    relevantTags: ["Pizza", "Conventional", "Organic", "Gluten-Free", "Single Serve", "Family Size"] },
  { name: "Frozen Burritos", aliases: ["burrito", "frozen burrito"],
    category: "Frozen", defaultUnit: "ct",
    relevantTags: ["Burrito", "Conventional", "Organic", "Single Serve"] },
  { name: "Ice Cream", aliases: ["icecream", "ice creme", "helado"],
    category: "Frozen", defaultUnit: "fl oz",
    relevantTags: ["Ice Cream", "Vanilla", "Flavored", "Low-Calorie", "Organic", "Plant-Based"] },
  { name: "Frozen Vegetables", aliases: ["frozen veggies", "frozen mixed vegetables"],
    category: "Frozen", defaultUnit: "oz",
    relevantTags: ["Vegetables", "Conventional", "Organic", "Steam-in-Bag"] },
  { name: "Frozen Fruit", aliases: ["frozen berries", "frozen strawberries", "frozen blueberries"],
    category: "Frozen", defaultUnit: "oz",
    relevantTags: ["Fruit", "Conventional", "Organic"] },
  { name: "Frozen Chicken", aliases: ["frozen chicken breast", "frozen chicken tenders"],
    category: "Frozen", defaultUnit: "lb",
    relevantTags: ["Chicken", "Conventional", "Organic", "Breaded"] },
  { name: "Frozen Waffles", aliases: ["waffles", "eggo waffles", "frozen waffle"],
    category: "Frozen", defaultUnit: "ct",
    relevantTags: ["Waffles", "Conventional", "Organic", "Gluten-Free"] },
  { name: "Frozen Shrimp", aliases: ["frozen camarones"],
    category: "Frozen", defaultUnit: "lb",
    relevantTags: ["Shrimp", "Wild-Caught", "Farm-Raised", "Peeled", "Shell-On"] },

  // ===== BEVERAGES =====
  { name: "Water", aliases: ["agua", "bottled water", "drinking water", "spring water"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Water", "Sparkling", "Regular", "Single Serve", "Electrolyte"] },
  { name: "Orange Juice", aliases: ["oj", "jugo de naranja"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Juice", "Regular", "Organic", "Cold-Pressed", "Concentrate", "Unsweetened"] },
  { name: "Apple Juice", aliases: ["jugo de manzana"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Juice", "Regular", "Organic", "Unsweetened"] },
  { name: "Soda", aliases: ["coke", "pepsi", "cola", "sprite", "refresco"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Soda", "Regular", "Diet", "Zero Sugar", "Flavored"] },
  { name: "Coffee", aliases: ["cafe", "ground coffee", "coffee beans", "instant coffee"],
    category: "Beverages", defaultUnit: "oz",
    relevantTags: ["Coffee", "Regular", "Decaf", "Organic", "Single Serve"] },
  { name: "Tea", aliases: ["te", "green tea", "black tea", "herbal tea"],
    category: "Beverages", defaultUnit: "ct",
    relevantTags: ["Tea", "Regular", "Organic", "Decaf", "Unsweetened"] },
  { name: "Sports Drink", aliases: ["gatorade", "powerade", "electrolyte drink"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Sports Drink", "Regular", "Zero Sugar", "Electrolyte", "Flavored"] },
  { name: "Energy Drink", aliases: ["red bull", "monster", "celsius"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Energy Drink", "Regular", "Zero Sugar", "Flavored"] },
  { name: "Lemonade", aliases: ["limonada"],
    category: "Beverages", defaultUnit: "fl oz",
    relevantTags: ["Lemonade", "Regular", "Organic", "Unsweetened"] },

  // ===== SNACKS =====
  { name: "Chips", aliases: ["potato chips", "papas", "papas fritas", "tortilla chips", "doritos", "lays"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Chips", "Regular", "Baked", "Kettle-Cooked", "Reduced Fat", "Organic", "Family Size", "Single Serve", "Spicy", "BBQ", "Salt & Vinegar"] },
  { name: "Crackers", aliases: ["cracker", "saltines", "goldfish", "ritz"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Crackers", "Regular", "Organic", "Gluten-Free", "Whole Grain", "Low-Sodium"] },
  { name: "Cookies", aliases: ["cookie", "galletas", "oreos"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Cookies", "Regular", "Organic", "Gluten-Free", "Family Size", "Single Serve"] },
  { name: "Nuts", aliases: ["mixed nuts", "almonds", "cashews", "peanuts", "walnuts", "nueces"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Nuts", "Regular", "Organic", "Salted", "Unsalted", "Roasted"] },
  { name: "Popcorn", aliases: ["palomitas", "microwave popcorn"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Popcorn", "Regular", "Organic", "Butter", "Kettle-Cooked", "Low-Sodium"] },
  { name: "Granola Bars", aliases: ["granola bar", "protein bar", "clif bar", "kind bar"],
    category: "Snacks", defaultUnit: "ct",
    relevantTags: ["Granola Bar", "Protein Bar", "Regular", "Organic", "Gluten-Free", "Protein"] },
  { name: "Trail Mix", aliases: ["trail mix"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Trail Mix", "Regular", "Organic", "Nuts"] },
  { name: "Jerky", aliases: ["beef jerky", "turkey jerky"],
    category: "Snacks", defaultUnit: "oz",
    relevantTags: ["Jerky", "Regular", "Organic", "Spicy"] },

  // ===== PANTRY =====
  { name: "Rice", aliases: ["arroz", "white rice", "brown rice", "jasmine rice", "basmati rice"],
    category: "Pantry", defaultUnit: "lb",
    relevantTags: ["Rice", "Regular", "Organic", "Whole Grain", "Instant"] },
  { name: "Pasta", aliases: ["spaghetti", "penne", "macaroni", "fideo", "noodles"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Pasta", "Regular", "Organic", "Gluten-Free", "Whole Grain"] },
  { name: "Beans", aliases: ["frijoles", "black beans", "pinto beans", "kidney beans", "refried beans"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Beans", "Canned", "Dried", "Regular", "Organic", "Low-Sodium"] },
  { name: "Cereal", aliases: ["cheerios", "frosted flakes", "corn flakes"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Cereal", "Regular", "Organic", "Gluten-Free", "Whole Grain", "No Sugar Added", "Family Size"] },
  { name: "Oatmeal", aliases: ["oats", "avena", "instant oatmeal"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Oatmeal", "Regular", "Organic", "Instant", "Whole Grain"] },
  { name: "Canned Tomatoes", aliases: ["diced tomatoes", "crushed tomatoes", "tomato sauce", "tomate en lata"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Canned Tomato", "Regular", "Organic", "Low-Sodium", "No Sugar Added"] },
  { name: "Soup", aliases: ["sopa", "chicken soup", "tomato soup", "canned soup"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Soup", "Canned", "Regular", "Organic", "Low-Sodium"] },
  { name: "Peanut Butter", aliases: ["crema de cacahuate", "PB", "pb"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Peanut Butter", "Regular", "Organic", "No Sugar Added"] },
  { name: "Jelly", aliases: ["jam", "mermelada", "preserves", "grape jelly", "strawberry jam"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Jelly", "Regular", "Organic", "No Sugar Added"] },
  { name: "Olive Oil", aliases: ["aceite de oliva", "EVOO"],
    category: "Pantry", defaultUnit: "fl oz",
    relevantTags: ["Olive Oil", "Extra Virgin", "Regular", "Organic"] },
  { name: "Cooking Oil", aliases: ["vegetable oil", "canola oil", "aceite"],
    category: "Pantry", defaultUnit: "fl oz",
    relevantTags: ["Cooking Oil", "Regular", "Organic"] },
  { name: "Flour", aliases: ["harina", "all purpose flour", "bread flour"],
    category: "Pantry", defaultUnit: "lb",
    relevantTags: ["Flour", "Regular", "Organic", "Whole Grain", "Gluten-Free"] },
  { name: "Sugar", aliases: ["azucar", "brown sugar", "powdered sugar"],
    category: "Pantry", defaultUnit: "lb",
    relevantTags: ["Sugar", "Regular", "Organic"] },
  { name: "Honey", aliases: ["miel"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Honey", "Regular", "Organic", "Raw"] },
  { name: "Broth", aliases: ["caldo", "chicken broth", "beef broth", "vegetable broth", "stock"],
    category: "Pantry", defaultUnit: "fl oz",
    relevantTags: ["Broth", "Regular", "Organic", "Low-Sodium"] },
  { name: "Salsa", aliases: ["salsa verde", "pico de gallo"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Sauce", "Regular", "Organic", "Spicy"] },
  { name: "Ketchup", aliases: ["catsup"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Sauce", "Regular", "Organic", "No Sugar Added"] },
  { name: "Mayonnaise", aliases: ["mayo", "mayonesa"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Sauce", "Regular", "Organic", "Low-Fat"] },
  { name: "Mustard", aliases: ["mostaza"],
    category: "Pantry", defaultUnit: "oz",
    relevantTags: ["Sauce", "Regular", "Organic", "Spicy"] },

  // ===== HOUSEHOLD =====
  { name: "Paper Towels", aliases: ["paper towel", "toalla de papel"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Paper Towels", "Regular", "Eco-Friendly", "Bulk"] },
  { name: "Toilet Paper", aliases: ["bath tissue", "papel de baño"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Toilet Paper", "Regular", "Eco-Friendly", "Sensitive", "Bulk"] },
  { name: "Trash Bags", aliases: ["garbage bags", "bolsas de basura"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Trash Bags", "Regular", "Heavy-Duty", "Eco-Friendly"] },
  { name: "Dish Soap", aliases: ["dishwashing liquid", "jabon de platos"],
    category: "Household", defaultUnit: "fl oz",
    relevantTags: ["Dish Soap", "Regular", "Eco-Friendly", "Fragrance-Free", "Concentrated"] },
  { name: "Laundry Detergent", aliases: ["detergent", "detergente", "laundry soap"],
    category: "Household", defaultUnit: "fl oz",
    relevantTags: ["Laundry Detergent", "Regular", "Eco-Friendly", "Fragrance-Free", "Sensitive", "Concentrated"] },
  { name: "Aluminum Foil", aliases: ["tin foil", "papel aluminio"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Aluminum Foil", "Regular", "Heavy-Duty"] },
  { name: "Plastic Wrap", aliases: ["saran wrap", "cling wrap"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Plastic Wrap", "Regular"] },
  { name: "Zip Bags", aliases: ["ziploc bags", "ziplock bags", "storage bags", "freezer bags"],
    category: "Household", defaultUnit: "ct",
    relevantTags: ["Zip Bags", "Regular", "Bulk"] },
];

/**
 * Fuzzy search: find products matching a query string.
 * Checks against name and all aliases.
 * Returns matches sorted by relevance (exact > starts-with > contains).
 */
export function searchProducts(query: string): ProductEntry[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();

  const scored: Array<{ product: ProductEntry; score: number }> = [];

  for (const product of PRODUCT_CATALOG) {
    let bestScore = 0;
    const allNames = [product.name, ...product.aliases];

    for (const name of allNames) {
      const lower = name.toLowerCase();
      if (lower === q) {
        bestScore = Math.max(bestScore, 100); // Exact match
      } else if (lower.startsWith(q)) {
        bestScore = Math.max(bestScore, 80); // Starts with
      } else if (q.startsWith(lower)) {
        bestScore = Math.max(bestScore, 70); // Query contains the full name
      } else if (lower.includes(q)) {
        bestScore = Math.max(bestScore, 60); // Contains
      } else if (q.length >= 3 && fuzzyMatch(q, lower)) {
        bestScore = Math.max(bestScore, 40); // Fuzzy/typo match
      }
    }

    if (bestScore > 0) {
      scored.push({ product, score: bestScore });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.product);
}

/**
 * Simple fuzzy matching for typos. Checks if most characters of the query
 * appear in the target in roughly the right order (allows 1-2 mismatches).
 */
function fuzzyMatch(query: string, target: string): boolean {
  if (Math.abs(query.length - target.length) > 3) return false;

  // Levenshtein-ish: count matching chars in order
  let qi = 0;
  let matches = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      matches++;
      qi++;
    }
  }

  // Allow up to 2 mismatches for words 4+ chars
  const maxMisses = query.length <= 4 ? 1 : 2;
  return matches >= query.length - maxMisses;
}
