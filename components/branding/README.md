# FineTuneLab Branding Components

Reusable SVG logo components for the FineTuneLab brand.

## Components

### FineTuneLabIconOnly
Standalone adjusting F icon without wordmark.

**Best for**: App icon, favicon, social media profile picture, compact spaces

**Usage**:
```tsx
import { FineTuneLabIconOnly } from '@/components/branding';

// Default (120x120)
<FineTuneLabIconOnly />

// Custom size
<FineTuneLabIconOnly size={64} />

// With className
<FineTuneLabIconOnly size={32} className="opacity-80" />
```

### FineTuneLabFullLogo
F icon with "FineTuneLab" wordmark.

**Best for**: Primary logo for website, marketing materials, presentations

**Usage**:
```tsx
import { FineTuneLabFullLogo } from '@/components/branding';

// Default (400x120)
<FineTuneLabFullLogo />

// Custom dimensions
<FineTuneLabFullLogo width={300} height={90} />

// With className
<FineTuneLabFullLogo className="hover:opacity-80" />
```

## Import Aliases

```tsx
// Short aliases
import { FTLIcon, FTLLogo } from '@/components/branding';

<FTLIcon size={48} />
<FTLLogo width={200} />
```

## Colors

- Primary Orange: `#FF6B35`
- Ghost/Shadow: `#FF6B35` at 30% opacity
- Text: `#000000`

## Design Concept

The adjusting F represents fine-tuning:
- **Tilted F (ghost)**: Misaligned/pre-tuning state
- **Straight F (solid)**: Aligned/post-tuning state
- **Visual motion**: Shows transformation process

## File Formats

These are React components rendering inline SVG. For other formats:

- **SVG Export**: Copy the SVG markup from the component
- **PNG/JPG**: Use browser screenshot tools or Figma export
- **Favicon**: Use `FineTuneLabIconOnly` at 16x16, 32x32, 64x64

## Accessibility

All components include:
- `<title>` for screen readers
- `<desc>` for detailed description
- Semantic markup
