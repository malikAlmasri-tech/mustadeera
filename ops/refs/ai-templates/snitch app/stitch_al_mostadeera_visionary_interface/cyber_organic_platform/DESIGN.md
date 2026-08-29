---
name: Cyber-Organic Platform
colors:
  surface: '#111417'
  surface-dim: '#111417'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#191c1f'
  surface-container: '#1d2023'
  surface-container-high: '#282a2e'
  surface-container-highest: '#323539'
  on-surface: '#e1e2e7'
  on-surface-variant: '#b9caca'
  inverse-surface: '#e1e2e7'
  inverse-on-surface: '#2e3134'
  outline: '#849495'
  outline-variant: '#3a494a'
  surface-tint: '#00dce5'
  primary: '#e9feff'
  on-primary: '#003739'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00696e'
  secondary: '#dcb8ff'
  on-secondary: '#480081'
  secondary-container: '#7701d0'
  on-secondary-container: '#dcb7ff'
  tertiary: '#fbf9ff'
  on-tertiary: '#2a303f'
  tertiary-container: '#d8ddf1'
  on-tertiary-container: '#5b6172'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#efdbff'
  secondary-fixed-dim: '#dcb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6700b5'
  tertiary-fixed: '#dde2f6'
  tertiary-fixed-dim: '#c1c6d9'
  on-tertiary-fixed: '#151b29'
  on-tertiary-fixed-variant: '#414756'
  background: '#111417'
  on-background: '#e1e2e7'
  surface-variant: '#323539'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.03em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-compact: 8px
  stack-airy: 48px
---

## Brand & Style

The design system is built on a **Cyber-Organic** aesthetic, a fusion of high-precision technological utility and fluid, natural forms. It targets a professional yet forward-thinking audience that values both efficiency and aesthetic immersion. The UI should evoke a sense of "digital bioluminescence"—feeling alive, responsive, and deeply technical.

The style leverages **Glassmorphism** and **Tactile Depth** to create a multi-layered interface where data floats on translucent planes. Motion is critical; transitions should feel like fluid ripples rather than rigid shifts, softening the hard edges of complex booking data.

## Colors

The palette is rooted in a **Deep Midnight** foundation to maximize the luminosity of the accent colors. 

- **Primary (Luminous Teal):** Used for critical actions, active states, and precision indicators. It represents the "cyber" aspect of the system.
- **Secondary (Vibrant Violet):** Used for accents, secondary interactions, and branding elements. It provides a biological, soft contrast to the teal.
- **Background & Surfaces:** Surfaces utilize a dark, desaturated navy base with varying levels of transparency. Glows are applied sparingly as backdrops to high-priority components to create a sense of radiant energy.

## Typography

Typography prioritizes clarity and technical precision. **Geist** is used for headlines and labels to provide a mono-spaced, engineered feel, emphasized by wide tracking in display sizes. **Inter** is used for body copy to ensure maximum legibility within dense data environments. 

All headers should be set with increased letter spacing to enhance the "airy" feel of the brand, while labels use all-caps and high tracking to denote functional metadata.

## Layout & Spacing

This design system employs a **Fluid Grid** with generous external margins to create a "floating" interface effect. 

- **Desktop:** 12-column grid with 24px gutters. Use wide 64px outer margins to push content toward the center, creating a focus area.
- **Data Views:** In complex management views, the spacing rhythm shifts from "Airy" (48px+) to "Functional" (8px-12px) to allow for high information density without sacrificing the organic feel.
- **Safe Areas:** Background blurs should extend to the edge of the viewport, but interactive content must respect the organic curvature of container backgrounds.

## Elevation & Depth

Hierarchy is established through **Glassmorphic Layers** and **Luminous Outlines** rather than traditional drop shadows.

1.  **Base Layer:** The Deep Midnight background.
2.  **Surface Layer:** Semi-transparent containers (`rgba(18, 24, 38, 0.7)`) with a 20px - 40px backdrop blur.
3.  **Active Layer:** Elements in focus or active states feature a 1px inner border of Luminous Teal and a soft outer glow (`box-shadow: 0 0 15px rgba(0, 245, 255, 0.3)`).
4.  **Floating Elements:** Tooltips and modals use a higher transparency and a more aggressive blur to appear physically closer to the user.

## Shapes

The shape language is dominated by **hyper-rounded corners** and **pill shapes**, mirroring biological cells or fluid droplets. 

- **Main Containers:** Use a minimum radius of 24px to 32px.
- **Buttons & Inputs:** Utilize a full pill-shape (`rounded-full`) for primary actions to reinforce the organic aesthetic.
- **Interactive States:** On hover, shapes may subtly "swell" or expand, mimicking a physical reaction to touch.

## Components

- **Buttons:** Primary buttons are pill-shaped with a Luminous Teal gradient fill. Secondary buttons use a glassmorphic background with a subtle Teal border.
- **Glass Cards:** The standard container for booking details. Must include a 1px "specular highlight" border on the top and left edges to simulate light hitting glass.
- **Input Fields:** Minimalist under-line or fully rounded glass fields. Focus states must trigger a soft Teal glow that illuminates the surrounding surface.
- **Chips/Badges:** Small, highly vibrant pill shapes. Use Luminous Teal for "Confirmed" and Vibrant Violet for "Pending."
- **Data Tables:** Remove traditional row lines. Use subtle tonal shifts in the background on hover and generous horizontal padding within cells.
- **Booking Timeline:** A fluid, continuous line component with glowing nodes, representing the organic flow of time and scheduling.