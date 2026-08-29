---
name: Midnight Athletic
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#37393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c3caac'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#8d9479'
  outline-variant: '#434933'
  surface-tint: '#a3d800'
  primary: '#ffffff'
  on-primary: '#263500'
  primary-container: '#baf600'
  on-primary-container: '#516e00'
  inverse-primary: '#4c6700'
  secondary: '#c3c6ce'
  on-secondary: '#2d3137'
  secondary-container: '#43474e'
  on-secondary-container: '#b2b5bd'
  tertiary: '#ffffff'
  on-tertiary: '#2f3035'
  tertiary-container: '#e2e2e8'
  on-tertiary-container: '#636469'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#baf600'
  primary-fixed-dim: '#a3d800'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#394e00'
  secondary-fixed: '#dfe2eb'
  secondary-fixed-dim: '#c3c6ce'
  on-secondary-fixed: '#181c22'
  on-secondary-fixed-variant: '#43474e'
  tertiary-fixed: '#e2e2e8'
  tertiary-fixed-dim: '#c6c6cc'
  on-tertiary-fixed: '#1a1c20'
  on-tertiary-fixed-variant: '#45474b'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 64px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  stats-xl:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: '1.0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-margin: 24px
  gutter: 16px
  bento-gap: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system embodies the "Midnight Athletic" aesthetic: a high-octane, premium environment designed for the modern athlete and sports-tech enthusiast. The brand personality is disruptive and energetic, utilizing high-contrast visuals to command attention and drive performance.

The visual style is a fusion of **Hyper-modernism** and **Glassmorphism**, characterized by:
- **Bento-box Layouts:** Modular, grid-based content organization that suggests efficiency and data precision.
- **Luminous Depth:** The use of subtle glowing borders and translucent layers to create a multi-dimensional, "heads-up display" (HUD) feel.
- **Kinetic Contrast:** A dark, immersive foundation interrupted by sharp, electric accents to guide the user's eye to high-energy actions.

## Colors

The palette is optimized for low-light environments, emphasizing high legibility and "glowing" interactive elements.

- **Primary (Electric Lime):** Reserved exclusively for high-energy CTAs, progress indicators, and critical data points. It should feel like it is emitting light against the dark background.
- **Surface (Pitch Grey):** Used for bento-grid cards and container backgrounds. These surfaces often utilize varying levels of opacity to create glassmorphic effects.
- **Background (Deep Dark Navy):** The bedrock of the UI. It provides a premium, "midnight" depth that makes the accent colors pop.
- **Typography:** Pure white is used for primary headings to ensure maximum impact, while a muted grey is used for secondary metadata to maintain visual hierarchy.

## Typography

Typography is used as a structural element. Headings are aggressive, heavy-weighted, and often uppercase to evoke the power of athletic branding.

- **Headlines:** Utilize **Montserrat** with extra-bold or black weights. The tight letter-spacing and heavy weight create a sense of urgency and strength.
- **Body:** **Inter** provides a systematic, neutral counter-balance to the expressive headings, ensuring high readability for data-dense sections.
- **Data/Labels:** **JetBrains Mono** is introduced for technical data points, stopwatch timers, and "spec" labels to reinforce the "tech" in sports-tech.

## Layout & Spacing

This design system employs a **Bento-box grid** model. Content is organized into distinct, varied-size rectangles that fit together in a tight, efficient mosaic.

- **Grid:** A 12-column fluid grid for desktop, collapsing to 1 column for mobile.
- **Bento Modules:** Use a consistent `bento-gap` (20px) between all cards to maintain a clean "channel" of background color between elements.
- **Padding:** Internal card padding should be generous (`stack-lg`) to prevent data density from becoming overwhelming.
- **Responsive Behavior:** On mobile, bento cards stack vertically, maintaining the same 20px gap to preserve the modular feel.

## Elevation & Depth

Depth is achieved through layering and light simulation rather than traditional shadows.

- **Backdrop Blur:** All cards and modals use a `20px` to `40px` blur on the background layer, allowing the deep navy background to peak through with a frosted effect.
- **Glow Borders:** Interactive elements and primary containers feature a 1px inner or outer stroke in `Electric Lime` at low opacity (10-20%). This creates a "powered-on" effect.
- **Tonal Stacking:** Surfaces closer to the user are slightly lighter (#2A2E35) than the base card color (#1E2228), creating a clear hierarchy of importance.
- **Ambient Glow:** Critical CTAs may have a soft, blurred outer glow (drop-shadow with 0 offset, large blur) using the primary accent color to simulate light emission.

## Shapes

The shape language balances modern sleekness with structural rigidity. 

- **Primary Containers:** All bento-style cards use `rounded-lg` (1rem/16px) to soften the "tech" edge and make the UI feel premium.
- **Interaction Elements:** Buttons and input fields follow the `rounded-lg` standard.
- **Data Chips:** Small badges and status indicators use a full "pill" shape to contrast against the rectangular grid.

## Components

### Buttons
- **Primary:** Background in #C1FF00, text in #0A0C10 (Black). High-gloss finish or subtle glow on hover.
- **Secondary:** Transparent background with a 1px #FFFFFF border and white text.
- **Ghost:** No background, white text, reveals a Pitch Grey background on hover.

### Bento Cards
- Background: `#1E2228` at 80% opacity.
- Border: 1px solid `rgba(255, 255, 255, 0.1)`.
- Highlight: On hover, the border transitions to #C1FF00 at 40% opacity.

### Input Fields
- Dark, recessed appearance using `#0A0C10`. 
- Focused state: 1px border in #C1FF00 with a subtle outer glow.
- Typography: Use JetBrains Mono for input text to feel like "data entry."

### Chips & Badges
- Used for categories (e.g., "LIVE", "STRENGTH", "RECOVERY").
- "LIVE" indicators should use a pulsing #C1FF00 dot next to the label.

### Progress Bars
- Track: `#1E2228`.
- Indicator: Linear gradient from `#C1FF00` to a slightly darker lime.
- Height: Thick (8px+) for athletic impact.