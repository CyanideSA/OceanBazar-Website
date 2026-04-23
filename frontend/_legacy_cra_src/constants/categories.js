/**
 * Mirrors backend seed / nav defaults when GET /api/categories is empty or fails.
 * Uses nested `children` to match the tree structure returned by the backend.
 */
export const CATEGORY_FALLBACK = [
  {
    name: 'Consumer Electronics',
    icon: 'Monitor',
    children: [
      { name: 'Mobile Phones', icon: 'Smartphone' },
      { name: 'Laptops & Tablets', icon: 'Laptop' },
      { name: 'Audio & Headphones', icon: 'Headphones' },
      { name: 'Cameras & Photography', icon: 'Camera' },
    ],
  },
  {
    name: 'Apparel & Accessories',
    icon: 'Shirt',
    children: [
      { name: "Men's Clothing", icon: 'Shirt' },
      { name: "Women's Clothing", icon: 'Shirt' },
      { name: 'Shoes & Footwear', icon: 'Footprints' },
      { name: 'Watches & Jewelry', icon: 'Watch' },
    ],
  },
  {
    name: 'Home & Garden',
    icon: 'Home',
    children: [
      { name: 'Furniture', icon: 'Armchair' },
      { name: 'Kitchen & Dining', icon: 'ChefHat' },
      { name: 'Lighting', icon: 'Lightbulb' },
      { name: 'Garden & Outdoor', icon: 'Flower2' },
    ],
  },
  {
    name: 'Sports & Entertainment',
    icon: 'Dumbbell',
    children: [
      { name: 'Fitness Equipment', icon: 'Dumbbell' },
      { name: 'Outdoor Recreation', icon: 'Mountain' },
      { name: 'Team Sports', icon: 'Trophy' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    icon: 'Sparkles',
    children: [
      { name: 'Skincare', icon: 'Droplets' },
      { name: 'Makeup & Cosmetics', icon: 'Sparkles' },
      { name: 'Hair Care', icon: 'Scissors' },
    ],
  },
  {
    name: 'Machinery & Industrial',
    icon: 'Cog',
    children: [
      { name: 'Power Tools', icon: 'Wrench' },
      { name: 'Industrial Equipment', icon: 'Factory' },
      { name: 'Electrical Supplies', icon: 'Zap' },
    ],
  },
  {
    name: 'Luggage, Bags & Cases',
    icon: 'Briefcase',
    children: [
      { name: 'Travel Bags', icon: 'Briefcase' },
      { name: 'Backpacks', icon: 'Backpack' },
      { name: 'Wallets & Purses', icon: 'Wallet' },
    ],
  },
  {
    name: 'Toys & Hobbies',
    icon: 'Gamepad2',
    children: [
      { name: 'Educational Toys', icon: 'BookOpen' },
      { name: 'Video Games', icon: 'Gamepad2' },
      { name: 'Arts & Crafts', icon: 'Palette' },
    ],
  },
];
