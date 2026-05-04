import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen, Layers, DollarSign, Users, LayoutDashboard, BarChart3,
  ArrowRight, ShieldCheck, ClipboardList, UserCircle, Building2,
  FolderPlus, TrendingUp, Github, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/useInView'

// ─── Nav ────────────────────────────────────────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      aria-label="Site navigation"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/85 backdrop-blur-md border-b border-gray-200/70 shadow-sm'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label="PPM Tool home" className="text-lg font-bold tracking-tight">
          <span className="text-blue-600">PPM</span>
          <span className="text-gray-800"> Tool</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-hidden text-center"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(221.2 83.2% 95%) 0%, transparent 70%), ' +
          'linear-gradient(to bottom, #ffffff 0%, #f8faff 100%)',
      }}
    >
      {/* Decorative glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'hsl(221.2 83.2% 53.3%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        <p
          className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase mb-5 animate-hero-fade-up"
          style={{ animationDelay: '0.05s' }}
        >
          Open Source · Self-Hosted · Free Forever
        </p>

        <h1
          className="text-5xl sm:text-6xl lg:text-[4.5rem] font-bold tracking-tight text-gray-900 leading-[1.05] mb-6 animate-hero-fade-up"
          style={{ animationDelay: '0.15s' }}
        >
          Portfolio Management
          <br />
          <span className="text-blue-600">Built for Every Team</span>
        </h1>

        <p
          className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-hero-fade-up"
          style={{ animationDelay: '0.3s' }}
        >
          Plan projects, track budgets, and deliver results — running entirely
          on Cloudflare's free tier. No subscriptions. No cold starts.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 items-center justify-center animate-hero-fade-up"
          style={{ animationDelay: '0.45s' }}
        >
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold
                       px-8 py-4 rounded-full text-base hover:bg-blue-700
                       transition-colors duration-200 shadow-lg shadow-blue-600/25"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700
                       font-semibold px-8 py-4 rounded-full text-base
                       hover:border-gray-400 hover:bg-gray-50 transition-colors duration-200"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip() {
  const stats = [
    '100% Free',
    'Cloudflare Edge',
    'Zero Cold Starts',
    'CAPEX / OPEX Tracking',
    'Up to 50+ Users',
  ]
  return (
    <div className="border-y border-gray-100 bg-gray-50/70 py-5">
      <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-10 gap-y-3">
        {stats.map((s) => (
          <div key={s} className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

interface FeatureItem {
  icon: React.ElementType
  title: string
  desc: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: FolderOpen,
    title: 'Portfolio Management',
    desc: 'Organise programs and projects in a hierarchy with real-time RAG health status across your entire portfolio.',
  },
  {
    icon: Layers,
    title: 'Agile + Waterfall',
    desc: 'Hybrid methodology support. Run Kanban sprints alongside Waterfall phases in the same project.',
  },
  {
    icon: DollarSign,
    title: 'Budget Engine',
    desc: 'Automatic CAPEX/OPEX tracking based on time logs. Burn rate, EAC, and CPI calculated hourly by a cron worker.',
  },
  {
    icon: Users,
    title: 'Resource Planning',
    desc: 'Weekly allocation heatmaps, utilisation bars, and rate snapshots that protect historical cost accuracy.',
  },
  {
    icon: LayoutDashboard,
    title: 'Kanban + Gantt',
    desc: 'Drag-and-drop Kanban board and a Gantt chart with cross-project dependency arrows.',
  },
  {
    icon: BarChart3,
    title: 'Status Reports',
    desc: 'One-click RAG status reports with schedule, budget, and scope indicators. Print to PDF in one click.',
  },
]

function FeatureCard({ icon: Icon, title, desc, delay }: FeatureItem & { delay: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm',
        'transition-all duration-700 ease-out',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  )
}

function FeaturesSection() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div
          ref={ref}
          className={cn(
            'text-center mb-14 transition-all duration-700 ease-out',
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
          )}
        >
          <p className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Everything Your Portfolio Needs
          </h2>
          <p className="text-gray-600 mt-3 max-w-xl mx-auto leading-relaxed">
            From high-level programme oversight to individual time logs — one tool,
            four roles, zero compromises.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

interface StepItem {
  number: string
  title: string
  desc: string
  icon: React.ElementType
}

const STEPS: StepItem[] = [
  {
    number: '01',
    icon: Building2,
    title: 'Setup Your Org',
    desc: 'Create your organisation and admin account in under two minutes. No credit card needed.',
  },
  {
    number: '02',
    icon: FolderPlus,
    title: 'Add Projects',
    desc: 'Structure programmes, define CAPEX/OPEX budgets, assign roles and invite team members.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Track & Report',
    desc: 'Real-time RAG health, burn rate, resource heatmaps, and one-click status reports.',
  },
]

function StepCard({ number, title, desc, icon: Icon, delay }: StepItem & { delay: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={cn(
        'text-center transition-all duration-700 ease-out',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
        <Icon className="w-8 h-8 text-blue-600" />
      </div>
      <span className="text-xs font-bold tracking-[0.2em] text-blue-400 uppercase">{number}</span>
      <h3 className="text-lg font-semibold text-gray-900 mt-1.5 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">{desc}</p>
    </div>
  )
}

function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="py-28 px-6 bg-gray-50/50">
      <div className="max-w-5xl mx-auto">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16 transition-all duration-700 ease-out',
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
          )}
        >
          <p className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase mb-3">
            How it Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Up and Running in Minutes
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
          <div className="hidden md:block absolute top-10 left-[33%] right-[33%] h-px bg-gray-200" />
          {STEPS.map((step, i) => (
            <StepCard key={step.number} {...step} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Roles ────────────────────────────────────────────────────────────────────

interface RoleItem {
  role: string
  icon: React.ElementType
  color: string
  abilities: string[]
}

const ROLES: RoleItem[] = [
  {
    role: 'Admin',
    icon: ShieldCheck,
    color: 'bg-blue-50 text-blue-600',
    abilities: ['User management', 'Org-wide settings', 'Currency & billing', 'Full access'],
  },
  {
    role: 'Program Manager',
    icon: FolderOpen,
    color: 'bg-purple-50 text-purple-600',
    abilities: ['Programme oversight', 'Cross-project budgets', 'RAG reporting', 'Resource planning'],
  },
  {
    role: 'Project Manager',
    icon: ClipboardList,
    color: 'bg-green-50 text-green-600',
    abilities: ['Task management', 'Kanban + Gantt', 'Time log approvals', 'Sprint planning'],
  },
  {
    role: 'Team Member',
    icon: UserCircle,
    color: 'bg-amber-50 text-amber-600',
    abilities: ['Log time', 'View assigned tasks', 'Update task status', 'Weekly timesheet'],
  },
]

function RoleCard({ role, icon: Icon, color, abilities, delay }: RoleItem & { delay: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm',
        'transition-all duration-700 ease-out',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-3">{role}</h3>
      <ul className="space-y-1.5">
        {abilities.map((a) => (
          <li key={a} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            {a}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RolesSection() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div
          ref={ref}
          className={cn(
            'text-center mb-14 transition-all duration-700 ease-out',
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
          )}
        >
          <p className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase mb-3">
            Access Control
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Four Roles. Perfect Fit.
          </h2>
          <p className="text-gray-600 mt-3 max-w-xl mx-auto leading-relaxed">
            Each role sees exactly what it needs — no more, no less.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map((r, i) => (
            <RoleCard key={r.role} {...r} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA strip ────────────────────────────────────────────────────────────────

function CtaStrip() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="bg-gray-950 py-28 px-6 text-center">
      <div
        ref={ref}
        className={cn(
          'max-w-2xl mx-auto transition-all duration-700 ease-out',
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        )}
      >
        <p className="text-xs font-bold tracking-[0.2em] text-blue-400 uppercase mb-4">
          100% Free · Open Source
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4 leading-tight">
          Deploy in minutes.
          <br />
          Free forever.
        </h2>
        <p className="text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
          Self-hosted on Cloudflare Workers. No credit card. No subscription.
          Your data stays in your own Cloudflare account.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold
                     px-8 py-4 rounded-full text-base hover:bg-gray-100
                     transition-colors duration-200"
        >
          Get Started Free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-gray-100 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-base font-bold tracking-tight">
          <span className="text-blue-600">PPM</span>
          <span className="text-gray-800"> Tool</span>
        </span>
        <p className="text-sm text-gray-600">
          Open-source project portfolio management for self-hosters.
        </p>
        <a
          href="https://github.com/sinman-a/Project_management_tool"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Github className="w-4 h-4" />
          View on GitHub
        </a>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]
                   focus:bg-white focus:text-blue-700 focus:px-4 focus:py-2 focus:rounded-lg
                   focus:shadow-lg focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>
      <LandingNav />
      <main id="main-content">
        <HeroSection />
        <StatsStrip />
        <FeaturesSection />
        <HowItWorksSection />
        <RolesSection />
        <CtaStrip />
      </main>
      <LandingFooter />
    </div>
  )
}
