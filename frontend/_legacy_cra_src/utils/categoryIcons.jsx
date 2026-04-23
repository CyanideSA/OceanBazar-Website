import {
  Armchair,
  Backpack,
  BookOpen,
  Briefcase,
  Camera,
  ChefHat,
  Cog,
  Droplets,
  Dumbbell,
  Factory,
  Flower2,
  Footprints,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  LayoutGrid,
  Lightbulb,
  Monitor,
  Mountain,
  Palette,
  Scissors,
  Shirt,
  Smartphone,
  Sparkles,
  Trophy,
  Wallet,
  Watch,
  Wrench,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  Armchair,
  Backpack,
  BookOpen,
  Briefcase,
  Camera,
  ChefHat,
  Cog,
  Droplets,
  Dumbbell,
  Factory,
  Flower2,
  Footprints,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  LayoutGrid,
  Lightbulb,
  Monitor,
  Mountain,
  Palette,
  Scissors,
  Shirt,
  Smartphone,
  Sparkles,
  Trophy,
  Wallet,
  Watch,
  Wrench,
  Zap,
};

/**
 * Resolves backend `Category.icon` (PascalCase lucide export name) to a component.
 */
export function getCategoryIcon(iconName) {
  if (iconName == null || String(iconName).trim() === '') {
    return LayoutGrid;
  }
  const key = String(iconName).trim();
  return ICON_MAP[key] || LayoutGrid;
}
