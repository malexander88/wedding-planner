import type { ReactElement, SVGProps } from 'react'
import type { SupplierCategory } from '../types'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10l8-6 8 6v10" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  )
}

export function IconHomeFill(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 4.2 3.8 11A1 1 0 0 0 3.5 11.7V19a1.6 1.6 0 0 0 1.6 1.6H9v-5.4h6V20.6h3.9A1.6 1.6 0 0 0 20.5 19v-7.3a1 1 0 0 0-.3-.7L12 4.2z" />
    </svg>
  )
}

export function IconPlan(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 9h6M9 12.5h6M9 16h3.5" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20 20" />
    </Svg>
  )
}

export function IconBudget(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.2" cy="14.2" r="1.15" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconGuests(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.2" r="2.6" />
      <path d="M4.6 18c.3-2.8 2.3-4.4 4.4-4.4s4.1 1.6 4.4 4.4" />
      <circle cx="16.2" cy="8.6" r="2.15" />
      <path d="M15.2 18c.2-1.9 1.3-3.2 2.9-3.6 1.5.4 2.5 1.6 2.8 3.6" />
    </Svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h4l1.6-2.4A2 2 0 0 1 11.2 5h1.6a2 2 0 0 1 1.6.6L16 8h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  )
}

export function IconBloom(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.2c.2 2.6 1.7 4.7 3.9 5.6-2.2.9-3.7 3-3.9 5.6-.2-2.6-1.7-4.7-3.9-5.6 2.2-.9 3.7-3 3.9-5.6z" />
      <path d="M7.5 14.2c.15 1.8 1.2 3.2 2.7 3.9-1.5.6-2.55 2-2.7 3.8" />
      <path d="M16.5 14.2c-.15 1.8-1.2 3.2-2.7 3.9 1.5.6 2.55 2 2.7 3.8" />
    </Svg>
  )
}

export function IconCake(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5v3M10.6 3.8c.5.7 1.4.7 1.9 0" />
      <path d="M6.5 10.5h11v3.2h-11z" />
      <path d="M5 13.7h14V20H5z" />
    </Svg>
  )
}

export function IconMusic(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.4" />
      <circle cx="17" cy="16" r="2.4" />
    </Svg>
  )
}

export function IconRings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.2" cy="12" r="4.4" />
      <circle cx="14.8" cy="12" r="4.4" />
    </Svg>
  )
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8.2" r="2.4" />
      <circle cx="16" cy="9.2" r="2.1" />
      <circle cx="11.5" cy="15.6" r="2.6" />
      <path d="M6.2 18.5c1.2-2 2.7-3 5.2-3.1 2.4 0 4.1.9 5.6 2.6" />
    </Svg>
  )
}

export function IconLeaf(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20c.4-4.6 3-8.2 8-9.4C19.2 5.2 16 3.4 12 4 8 3.4 4.8 5.2 4 10.6c5 1.2 7.6 4.8 8 9.4z" />
      <path d="M12 20S11 12 7 8" />
    </Svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" />
    </Svg>
  )
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="M15 10.5 21 7v10l-6-3.5z" />
    </Svg>
  )
}

export function IconUtensils(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4" />
      <path d="M6 13v7M16 4v16M14 4h4c0 3-2 4.5-2 7" />
    </Svg>
  )
}

export function IconCar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 15h16v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M5 15 7 9.5A2 2 0 0 1 8.8 8h6.4A2 2 0 0 1 17 9.5L19 15" />
      <circle cx="7.5" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="m4 8 8 6 8-6" />
    </Svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.2c.2 2.6 1.7 4.7 3.9 5.6-2.2.9-3.7 3-3.9 5.6-.2-2.6-1.7-4.7-3.9-5.6 2.2-.9 3.7-3 3.9-5.6z" />
      <path d="M18.5 14.5c.1 1.4.9 2.5 2 3-1.1.5-1.9 1.6-2 3-.1-1.4-.9-2.5-2-3 1.1-.5 1.9-1.6 2-3z" />
    </Svg>
  )
}

export function IconClipboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="5" width="12" height="16" rx="2" />
      <path d="M9 5.2V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v.7" />
      <path d="M9 11h6M9 14.5h6M9 18h3.5" />
    </Svg>
  )
}

export function IconScale(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v16M8 20h8M12 6 5 9l3 5c1.2-1 2.6-1.6 4-1.6" />
      <path d="M12 6 19 9l-3 5c-1.2-1-2.6-1.6-4-1.6" />
    </Svg>
  )
}

export function IconScissors(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="7" r="2.3" />
      <circle cx="6.5" cy="17" r="2.3" />
      <path d="M8.5 8.6 20 18M8.5 15.4 20 6" />
    </Svg>
  )
}

export function IconBrush(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 4.5 19.5 9.5 11 18H6v-5z" />
      <path d="M13 6.2 17.8 11" />
      <path d="M6 18c-1.5.4-2.6 1.5-3 3 1.5-.4 2.6-1.5 3-3z" />
    </Svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  )
}

const categoryMap: Record<SupplierCategory, (props: IconProps) => ReactElement> = {
  venue: IconHome,
  officiant: IconScale,
  photographer: IconCamera,
  videographer: IconVideo,
  catering: IconUtensils,
  florist: IconBloom,
  entertainment: IconMusic,
  cake: IconCake,
  attire: IconSparkle,
  hair: IconScissors,
  makeup: IconBrush,
  transport: IconCar,
  stationery: IconMail,
  decor: IconLeaf,
  planner: IconClipboard,
  other: IconSparkle,
}

export function CategoryIcon({ category, ...props }: IconProps & { category: string }) {
  const Cmp = categoryMap[category as SupplierCategory] ?? IconSparkle
  return <Cmp {...props} />
}

const stageMap: Record<string, (props: IconProps) => ReactElement> = {
  vision: IconPalette,
  venue: IconHome,
  date: IconCalendar,
  book: IconRings,
  people: IconGuests,
  legal: IconClipboard,
  details: IconSparkle,
}

export function StageIcon({ stage, ...props }: IconProps & { stage: string }) {
  const Cmp = stageMap[stage] ?? IconPlan
  return <Cmp {...props} />
}

/** The app mark: a gold ring with a small sparkle and an italic ampersand (matches the home-screen icon). */
export function BrandMark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="brand-svg">
      <circle cx="18" cy="19.2" r="10.6" fill="none" stroke="var(--gold)" strokeWidth="1.4" />
      <path fill="var(--gold)" d="M18 5.6c.3 1.5 1 2.3 2.4 2.6-1.4.3-2.1 1.1-2.4 2.6-.3-1.5-1-2.3-2.4-2.6 1.4-.3 2.1-1.1 2.4-2.6z" />
      <text x="18.3" y="25.6" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontSize="17" fill="var(--on-primary)">
        &amp;
      </text>
    </svg>
  )
}
