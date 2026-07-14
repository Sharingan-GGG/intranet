'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import React, { useCallback, useEffect, useState } from 'react'

// Mountain paths extracted from design
const FAR_PATH =
  'M0,260 C80,200 160,180 240,210 C320,240 380,170 460,160 C540,150 600,210 680,200 C760,190 830,140 910,170 C960,190 1000,210 1000,210 L1000,400 L0,400 Z'
const MID_PATH =
  'M0,280 C70,230 140,200 220,230 C290,255 340,180 420,190 C500,200 560,260 640,240 C720,220 800,170 880,200 C940,225 1000,260 1000,260 L1000,400 L0,400 Z'
const NEAR_PATH =
  'M0,300 C60,260 130,220 210,250 C280,275 330,210 410,230 C490,250 550,290 630,275 C710,260 790,220 870,250 C930,275 1000,290 1000,290 L1000,400 L0,400 Z'

const DAY = {
  sky: 'linear-gradient(180deg, rgb(93,163,217) 0%, rgb(135,188,224) 22%, rgb(176,212,236) 45%, rgb(216,227,239) 65%, rgb(240,216,184) 85%, rgb(244,200,144) 100%)',
  far: 'rgba(150,175,205,0.55)',
  mid: 'rgba(85,110,145,0.70)',
  near: 'rgba(40,60,90,0.82)',
  haze: 'rgba(255,215,170,0.45)',
  text: 'rgb(42,31,21)',
  textItalic: 'rgb(74,54,37)',
  sublabel: 'rgba(80,55,30,0.70)',
  btnBg: 'rgba(255,255,255,0.85)',
  btnBorder: 'rgba(255,255,255,0.95)',
  btnShadow:
    'rgba(40,30,15,0.40) 0px 14px 36px -14px, rgba(40,30,15,0.10) 0px 2px 6px 0px, rgba(255,255,255,0.60) 0px 1px 0px 0px inset',
  arrowColor: 'rgba(80,55,30,0.50)',
  toggleBg: 'rgba(255,255,255,0.70)',
  toggleColor: 'rgb(80,60,40)',
  inputBg: 'rgba(255,255,255,0.55)',
  inputBorder: 'rgba(255,255,255,0.85)',
  inputText: 'rgb(42,31,21)',
  inputPlaceholder: 'rgba(80,60,40,0.45)',
  vignette: 'radial-gradient(rgba(0,0,0,0) 50%, rgba(70,50,30,0.18) 100%)',
  bloom: 'radial-gradient(circle at 51% 49%, rgba(255,236,200,0.65) 0%, rgba(255,220,170,0.28) 30%, transparent 60%)',
}

const NIGHT = {
  sky: 'linear-gradient(180deg, rgb(14,10,53) 0%, rgb(28,20,82) 22%, rgb(54,36,110) 45%, rgb(75,49,134) 65%, rgb(90,58,150) 82%, rgb(107,74,166) 100%)',
  far: 'rgba(90,75,155,0.50)',
  mid: 'rgba(62,45,118,0.70)',
  near: 'rgba(28,16,72,0.90)',
  haze: 'rgba(120,80,200,0.20)',
  text: 'rgba(240,228,255,0.92)',
  textItalic: 'rgba(210,195,255,0.85)',
  sublabel: 'rgba(200,185,230,0.60)',
  btnBg: 'rgba(255,255,255,0.10)',
  btnBorder: 'rgba(255,255,255,0.22)',
  btnShadow:
    'rgba(0,0,40,0.60) 0px 14px 36px -14px, rgba(0,0,40,0.20) 0px 2px 6px 0px, rgba(255,255,255,0.12) 0px 1px 0px 0px inset',
  arrowColor: 'rgba(216,196,255,0.60)',
  toggleBg: 'rgba(255,255,255,0.12)',
  toggleColor: 'rgba(200,185,255,0.85)',
  inputBg: 'rgba(255,255,255,0.08)',
  inputBorder: 'rgba(255,255,255,0.20)',
  inputText: 'rgba(240,228,255,0.92)',
  inputPlaceholder: 'rgba(200,185,230,0.45)',
  vignette: 'radial-gradient(rgba(0,0,0,0) 40%, rgba(10,5,30,0.45) 100%)',
  bloom: 'radial-gradient(circle at 50% 40%, rgba(140,100,255,0.22) 0%, transparent 55%)',
}

// Stable star positions (deterministic to avoid hydration mismatch)
const STARS = Array.from({ length: 65 }, (_, i) => ({
  x: (((i * 61) % 97) / 97) * 100,
  y: (((i * 43) % 71) / 71) * 68,
  size: 1 + (i % 3) * 0.75,
  delay: (i * 0.19) % 5,
  dur: 3.5 + (i % 4) * 0.6,
}))

const FAR_CLOUDS = [
  { left: '4%', top: '10%', width: '22%', height: '13%' },
  { left: '55%', top: '7%', width: '28%', height: '15%' },
  { left: '34%', top: '19%', width: '20%', height: '10%' },
]
const NEAR_CLOUDS = [
  { left: '0%', top: '18%', width: '32%', height: '16%' },
  { left: '60%', top: '13%', width: '34%', height: '18%' },
  { left: '30%', top: '26%', width: '24%', height: '12%' },
]

// Auth.js error codes (?error=...) mapped to friendly messages
const AUTH_ERRORS: Record<string, string> = {
  AccessDenied: 'Please use your @complextravel.com.au Google account.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  Configuration: 'Sign-in is misconfigured. Please contact IT.',
  Default: 'Authentication failed. Please try again.',
}

const T = 'transition-all duration-[2000ms] ease-in-out'

interface Props {
  error?: string
  redirect?: string
  cormorantClass: string
}

export function LoginScene({ error, redirect, cormorantClass }: Props) {
  const router = useRouter()
  const [isNight, setIsNight] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const theme = isNight ? NIGHT : DAY
  const callbackUrl = redirect && redirect.startsWith('/') ? redirect : '/'
  const errorMessage = formError ?? (error ? (AUTH_ERRORS[error] ?? AUTH_ERRORS.Default) : null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setOffset({ x: (e.clientX - cx) / cx, y: (e.clientY - cy) / cy })
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    await signIn('google', { callbackUrl })
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      if (!res.ok) {
        setFormError('Invalid email or password.')
        setLoading(false)
        return
      }
      router.push(callbackUrl)
      router.refresh()
    } catch {
      setFormError('Could not sign in. Please try again.')
      setLoading(false)
    }
  }

  const px = offset.x
  const py = offset.y

  const inputStyle: React.CSSProperties = {
    background: theme.inputBg,
    borderColor: theme.inputBorder,
    color: theme.inputText,
    transition: 'background 2s, border-color 2s, color 2s',
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none cursor-default"
      onMouseMove={onMouseMove}
    >
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity:1; }
          50% { opacity:0.25; }
        }
        @keyframes aurora-a {
          0%,100% { transform:translate3d(0,0,0) scale(1); }
          40% { transform:translate3d(3%,2%,0) scale(1.06); }
          70% { transform:translate3d(-2%,1%,0) scale(0.97); }
        }
        @keyframes aurora-b {
          0%,100% { transform:translate3d(0,0,0) scale(1); }
          35% { transform:translate3d(-3%,-2%,0) scale(1.04); }
          65% { transform:translate3d(2%,1%,0) scale(0.96); }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(18px); }
          to { opacity:1; transform:translateY(0); }
        }
        .login-fade-up {
          opacity:0;
          animation:fade-up 0.7s ease forwards;
        }
        .login-fade-up:nth-child(1) { animation-delay:0.1s; }
        .login-fade-up:nth-child(2) { animation-delay:0.25s; }
        .login-fade-up:nth-child(3) { animation-delay:0.38s; }
        .login-fade-up:nth-child(4) { animation-delay:0.5s; }
        .login-fade-up:nth-child(5) { animation-delay:0.6s; }
        .login-scene-input::placeholder { color: var(--login-placeholder); }
      `}</style>

      {/* Sky */}
      <div className={`absolute inset-0 ${T}`} style={{ background: theme.sky }} />

      {/* Stars (night) */}
      {isNight && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `translate3d(${px * 9}px,${py * 5}px,0)` }}
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                boxShadow: `rgba(220,210,255,0.7) 0 0 ${s.size * 3}px`,
                animation: `twinkle ${s.dur}s ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Aurora (night) */}
      {isNight && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute"
            style={{
              width: '72%',
              height: '42%',
              top: '4%',
              left: '14%',
              background:
                'radial-gradient(60% 70%, rgba(120,255,220,0.50) 0%, rgba(110,170,255,0.35) 30%, rgba(180,120,255,0.18) 60%, transparent 100%)',
              filter: 'blur(32px)',
              animation: 'aurora-a 13s ease-in-out infinite',
            }}
          />
          <div
            className="absolute"
            style={{
              width: '62%',
              height: '36%',
              top: '9%',
              left: '24%',
              background:
                'radial-gradient(55% 70%, rgba(180,120,255,0.42) 0%, rgba(120,200,255,0.28) 35%, rgba(255,180,120,0.08) 65%, transparent 100%)',
              filter: 'blur(38px)',
              animation: 'aurora-b 16s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Far clouds (day) */}
      {!isNight && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `translate3d(${px * -6}px,${py * -3}px,0)` }}
        >
          {FAR_CLOUDS.map((c, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                ...c,
                background:
                  'radial-gradient(60% 100%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 35%, rgba(255,255,255,0.15) 65%, transparent 100%)',
                filter: 'blur(8px)',
              }}
            />
          ))}
        </div>
      )}

      {/* Near clouds (day) */}
      {!isNight && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `translate3d(${px * -11}px,${py * -5}px,0)` }}
        >
          {NEAR_CLOUDS.map((c, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                ...c,
                background:
                  'radial-gradient(60% 100%, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.55) 40%, rgba(245,250,255,0.18) 70%, transparent 100%)',
                filter: 'blur(14px)',
              }}
            />
          ))}
        </div>
      )}

      {/* Far mountain range */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '55%', transform: `translate3d(${px * -2}px,${py * 1}px,0)` }}
      >
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="h-full w-full">
          <path d={FAR_PATH} style={{ fill: theme.far, transition: 'fill 2s' }} />
        </svg>
      </div>

      {/* Mid mountain range */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '45%', transform: `translate3d(${px * -4}px,${py * -1.5}px,0)` }}
      >
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="h-full w-full">
          <path d={MID_PATH} style={{ fill: theme.mid, transition: 'fill 2s' }} />
        </svg>
      </div>

      {/* Near mountain range */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '35%', transform: `translate3d(${px * -7}px,${py * 1.5}px,0)` }}
      >
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="h-full w-full">
          <path d={NEAR_PATH} style={{ fill: theme.near, transition: 'fill 2s' }} />
        </svg>
      </div>

      {/* Horizon haze */}
      <div
        className={`pointer-events-none absolute inset-x-0 ${T}`}
        style={{
          height: '22%',
          bottom: '28%',
          background: `linear-gradient(transparent 0%, ${theme.haze} 50%, transparent 100%)`,
          transform: `translate3d(0,${py * 2}px,0)`,
        }}
      />

      {/* Bloom */}
      <div
        className={`pointer-events-none absolute inset-0 mix-blend-soft-light ${T}`}
        style={{
          background: theme.bloom,
          transform: `translate3d(${px * 5}px,${py * 3}px,0)`,
        }}
      />

      {/* Ground darkening */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: '18%',
          background: 'linear-gradient(rgba(50,35,20,0) 0%, rgba(50,35,20,0.16) 100%)',
        }}
      />

      {/* Vignette */}
      <div
        className={`pointer-events-none absolute inset-0 ${T}`}
        style={{ background: theme.vignette }}
      />

      {/* Day/Night toggle */}
      <button
        onClick={() => setIsNight((n) => !n)}
        className="absolute top-5 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-transform duration-150"
        style={{
          background: theme.toggleBg,
          color: theme.toggleColor,
          transition: 'background 2s, color 2s, transform 0.15s',
        }}
        aria-label="Toggle day/night theme"
      >
        {isNight ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </button>

      {/* Card */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          transform: mounted
            ? `perspective(1200px) rotateX(${py * -0.3}deg) rotateY(${px * 0.3}deg)`
            : undefined,
        }}
      >
        {/* Logo */}
        <div className="login-fade-up mb-10 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.webp"
            alt="Complex Travel Group"
            width={300}
            height={100}
            className="h-20 w-auto sm:h-[100px] object-contain"
            style={{
              filter: isNight ? 'drop-shadow(0 0 20px rgba(180,150,255,0.3))' : 'none',
              transition: 'filter 2s',
            }}
          />
        </div>

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="login-fade-up group inline-flex items-center gap-4 rounded-2xl border pl-3 pr-5 py-3.5 text-left backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:translate-y-px disabled:opacity-70"
          style={{
            background: theme.btnBg,
            borderColor: theme.btnBorder,
            boxShadow: theme.btnShadow,
            transition: 'background 2s, border-color 2s, box-shadow 2s, transform 0.1s',
          }}
        >
          {/* Google G in white circle */}
          <span
            className="grid place-items-center h-9 w-9 shrink-0 rounded-full shadow-inner"
            style={{ background: 'rgba(255,255,255,0.95)' }}
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </span>

          {/* Text */}
          <span className="flex flex-col leading-tight">
            <span
              className={cormorantClass}
              style={{
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                color: theme.text,
                transition: 'color 2s',
              }}
            >
              CTG{' '}
              <span
                style={{
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: theme.textItalic,
                  transition: 'color 2s',
                }}
              >
                Intranet
              </span>
            </span>
            <span
              className="mt-1.5 whitespace-nowrap"
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: theme.sublabel,
                transition: 'color 2s',
              }}
            >
              Continue with Google
            </span>
          </span>

          {/* Arrow */}
          <svg
            viewBox="0 0 24 24"
            className="ml-1 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: theme.arrowColor, transition: 'color 2s, transform 0.15s' }}
          >
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        </button>

        {/* Divider */}
        <div className="login-fade-up mt-6 flex w-full max-w-xs items-center gap-3">
          <span
            className="h-px flex-1"
            style={{ background: theme.inputBorder, transition: 'background 2s' }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              color: theme.sublabel,
              transition: 'color 2s',
            }}
          >
            or
          </span>
          <span
            className="h-px flex-1"
            style={{ background: theme.inputBorder, transition: 'background 2s' }}
          />
        </div>

        {/* Email / password login */}
        <form
          onSubmit={handlePasswordLogin}
          className="login-fade-up mt-6 flex w-full max-w-xs flex-col gap-3"
          style={{ ['--login-placeholder' as string]: theme.inputPlaceholder }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-scene-input w-full rounded-xl border px-4 py-2.5 text-sm backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style={inputStyle}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-scene-input w-full rounded-xl border px-4 py-2.5 text-sm backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border px-4 py-2.5 backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:translate-y-px disabled:opacity-70"
            style={{
              background: theme.btnBg,
              borderColor: theme.btnBorder,
              boxShadow: theme.btnShadow,
              transition: 'background 2s, border-color 2s, box-shadow 2s, transform 0.1s',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: theme.sublabel,
                transition: 'color 2s',
              }}
            >
              Sign in
            </span>
          </button>
        </form>

        {/* Error */}
        {errorMessage && (
          <p className="mt-4 text-sm" style={{ color: 'rgba(255,120,120,0.9)' }}>
            {errorMessage}
          </p>
        )}

        {/* Hint */}
        <p className="login-fade-up mt-6 text-xs" style={{ color: '#b3b3b3' }}>
          Use your{' '}
          <span className="underline underline-offset-2">@complextravel.com.au</span> account
        </p>
      </div>

      {/* Copyright */}
      <p
        className="absolute bottom-5 left-0 right-0 text-center text-[10px] tracking-[0.18em] uppercase"
        style={{ color: '#b3b3b3' }}
      >
        © Complex Travel Group · 2026
      </p>
    </div>
  )
}
