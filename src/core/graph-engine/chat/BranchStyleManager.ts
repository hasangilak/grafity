/**
 * Branch Style Manager
 *
 * Manages visual styling for conversation branches including:
 * - Color assignment from a curated palette
 * - Pattern assignment for colorblind accessibility
 * - Branch style caching and retrieval
 */

export interface BranchStyle {
  id: string;
  name: string;
  color: string;           // Hex color code
  pattern: 'solid' | 'dashed' | 'dotted';
  icon: string;            // Unicode icon or emoji
  createdAt: Date;
  createdFrom: string;     // Parent message ID
  isActive: boolean;
}

export interface BranchColorPalette {
  name: string;
  colors: string[];
  description: string;
}

/**
 * Curated color palettes for branch visualization
 */
const COLOR_PALETTES: Record<string, BranchColorPalette> = {
  default: {
    name: 'Default Palette',
    description: 'High-contrast colors optimized for readability',
    colors: [
      '#9C27B0',  // Purple (main branch)
      '#2196F3',  // Blue
      '#4CAF50',  // Green
      '#FF9800',  // Orange
      '#F44336',  // Red
      '#00BCD4',  // Cyan
      '#FFEB3B',  // Yellow
      '#795548',  // Brown
      '#607D8B',  // Blue Grey
      '#E91E63',  // Pink
      '#3F51B5',  // Indigo
      '#009688',  // Teal
    ]
  },
  colorblind: {
    name: 'Colorblind-Friendly Palette',
    description: 'Optimized for deuteranopia and protanopia',
    colors: [
      '#0173B2',  // Blue
      '#DE8F05',  // Orange
      '#029E73',  // Green
      '#CC78BC',  // Purple
      '#CA9161',  // Tan
      '#949494',  // Grey
      '#ECE133',  // Yellow
      '#56B4E9',  // Sky Blue
      '#E69F00',  // Yellow-Orange
      '#F0E442',  // Light Yellow
    ]
  },
  pastel: {
    name: 'Pastel Palette',
    description: 'Soft colors for reduced eye strain',
    colors: [
      '#B39DDB',  // Light Purple
      '#90CAF9',  // Light Blue
      '#A5D6A7',  // Light Green
      '#FFCC80',  // Light Orange
      '#EF9A9A',  // Light Red
      '#80DEEA',  // Light Cyan
      '#FFF59D',  // Light Yellow
      '#BCAAA4',  // Light Brown
      '#B0BEC5',  // Light Blue Grey
      '#F48FB1',  // Light Pink
    ]
  }
};

/**
 * Pattern options for enhanced accessibility
 */
const PATTERNS: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted'];

/**
 * Branch icons for visual distinction
 */
const BRANCH_ICONS = ['🌿', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌻', '🌺', '🌸', '🌼', '🌷'];

/**
 * Manages visual styling for conversation branches
 */
export class BranchStyleManager {
  private branchStyles: Map<string, BranchStyle> = new Map();
  private colorIndex: number = 0;
  private patternIndex: number = 0;
  private iconIndex: number = 0;
  private activePalette: string = 'default';

  /**
   * Get the active color palette
   */
  getColorPalette(): string[] {
    return COLOR_PALETTES[this.activePalette]?.colors || COLOR_PALETTES.default.colors;
  }

  /**
   * Get all available palettes
   */
  getAllPalettes(): BranchColorPalette[] {
    return Object.values(COLOR_PALETTES);
  }

  /**
   * Set the active color palette
   */
  setActivePalette(paletteName: string): void {
    if (COLOR_PALETTES[paletteName]) {
      this.activePalette = paletteName;
      // Reset color index when switching palettes
      this.colorIndex = 0;
    } else {
      console.warn(`Palette "${paletteName}" not found. Using default palette.`);
    }
  }

  /**
   * Assign a color to a branch (round-robin from palette)
   */
  assignColor(branchId: string): string {
    const existingStyle = this.branchStyles.get(branchId);
    if (existingStyle) {
      return existingStyle.color;
    }

    const palette = this.getColorPalette();
    const color = palette[this.colorIndex % palette.length];

    // Increment for next assignment
    this.colorIndex++;

    return color;
  }

  /**
   * Assign a pattern to a branch (for colorblind accessibility)
   */
  assignPattern(branchId: string): 'solid' | 'dashed' | 'dotted' {
    const existingStyle = this.branchStyles.get(branchId);
    if (existingStyle) {
      return existingStyle.pattern;
    }

    const pattern = PATTERNS[this.patternIndex % PATTERNS.length];

    // Increment for next assignment
    this.patternIndex++;

    return pattern;
  }

  /**
   * Assign an icon to a branch
   */
  assignIcon(branchId: string): string {
    const existingStyle = this.branchStyles.get(branchId);
    if (existingStyle) {
      return existingStyle.icon;
    }

    const icon = BRANCH_ICONS[this.iconIndex % BRANCH_ICONS.length];

    // Increment for next assignment
    this.iconIndex++;

    return icon;
  }

  /**
   * Create and store a complete branch style
   */
  createBranchStyle(
    branchId: string,
    branchName: string,
    createdFrom: string,
    isActive: boolean = false
  ): BranchStyle {
    // Check if style already exists
    const existingStyle = this.branchStyles.get(branchId);
    if (existingStyle) {
      return existingStyle;
    }

    const style: BranchStyle = {
      id: branchId,
      name: branchName,
      color: this.assignColor(branchId),
      pattern: this.assignPattern(branchId),
      icon: this.assignIcon(branchId),
      createdAt: new Date(),
      createdFrom,
      isActive
    };

    this.branchStyles.set(branchId, style);
    return style;
  }

  /**
   * Get branch style by ID
   */
  getBranchStyle(branchId: string): BranchStyle | undefined {
    return this.branchStyles.get(branchId);
  }

  /**
   * Get or create branch style
   */
  getOrCreateBranchStyle(
    branchId: string,
    branchName: string,
    createdFrom: string,
    isActive: boolean = false
  ): BranchStyle {
    const existingStyle = this.branchStyles.get(branchId);
    if (existingStyle) {
      return existingStyle;
    }

    return this.createBranchStyle(branchId, branchName, createdFrom, isActive);
  }

  /**
   * Get all branch styles
   */
  getAllBranchStyles(): BranchStyle[] {
    return Array.from(this.branchStyles.values());
  }

  /**
   * Update branch active state
   */
  setActiveBranch(branchId: string): void {
    // Deactivate all branches
    this.branchStyles.forEach(style => {
      style.isActive = false;
    });

    // Activate the specified branch
    const style = this.branchStyles.get(branchId);
    if (style) {
      style.isActive = true;
    }
  }

  /**
   * Rename a branch
   */
  renameBranch(branchId: string, newName: string): void {
    const style = this.branchStyles.get(branchId);
    if (style) {
      style.name = newName;
    }
  }

  /**
   * Remove branch style
   */
  removeBranchStyle(branchId: string): void {
    this.branchStyles.delete(branchId);
  }

  /**
   * Get legend data for visualization
   */
  getLegendData(): Array<{ color: string; pattern: string; icon: string; name: string; isActive: boolean }> {
    return Array.from(this.branchStyles.values()).map(style => ({
      color: style.color,
      pattern: style.pattern,
      icon: style.icon,
      name: style.name,
      isActive: style.isActive
    }));
  }

  /**
   * Highlight active branch path
   */
  highlightActivePath(branchId: string): {
    nodeColor: string;
    edgeColor: string;
    nodeStrokeWidth: number;
    edgeStrokeWidth: number;
  } {
    const style = this.branchStyles.get(branchId);

    if (!style) {
      return {
        nodeColor: '#999',
        edgeColor: '#ccc',
        nodeStrokeWidth: 2,
        edgeStrokeWidth: 1
      };
    }

    if (style.isActive) {
      // Active branch gets brighter colors and thicker strokes
      return {
        nodeColor: style.color,
        edgeColor: style.color,
        nodeStrokeWidth: 3,
        edgeStrokeWidth: 2.5
      };
    } else {
      // Inactive branches get muted colors
      return {
        nodeColor: this.lightenColor(style.color, 0.3),
        edgeColor: this.lightenColor(style.color, 0.5),
        nodeStrokeWidth: 2,
        edgeStrokeWidth: 1.5
      };
    }
  }

  /**
   * Lighten a color by a factor (0-1)
   */
  private lightenColor(color: string, factor: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Lighten by moving towards white
    const newR = Math.round(r + (255 - r) * factor);
    const newG = Math.round(g + (255 - g) * factor);
    const newB = Math.round(b + (255 - b) * factor);

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Check if a color has sufficient contrast with white background
   * (WCAG AA standard: 4.5:1 for normal text)
   */
  hasGoodContrast(color: string): boolean {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Contrast ratio with white background
    const contrast = (1 + 0.05) / (luminance + 0.05);

    return contrast >= 4.5;
  }

  /**
   * Reset all style assignments
   */
  reset(): void {
    this.branchStyles.clear();
    this.colorIndex = 0;
    this.patternIndex = 0;
    this.iconIndex = 0;
  }
}
