'use client'

import { motion } from 'framer-motion'

export default function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: `var(--color-background)` }}
    >
      {/* Radial gold gradient background overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.10) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201,168,76,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Subtle grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center w-full px-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo / App name */}
        <motion.div
          className="mb-8 flex flex-col items-center select-none"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Gold ornament line */}
          <div className="flex items-center gap-3 mb-3" aria-hidden="true">
            <div
              className="h-px w-10"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(201,168,76,0.6))',
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z"
                fill="var(--color-primary)"
                fillOpacity="0.8"
              />
            </svg>
            <div
              className="h-px w-10"
              style={{
                background:
                  'linear-gradient(90deg, rgba(201,168,76,0.6), transparent)',
              }}
            />
          </div>

          <h1
            className="text-5xl font-light tracking-[0.18em] uppercase"
            style={{
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              color: `var(--color-primary)`,
              letterSpacing: '0.22em',
              lineHeight: 1,
            }}
          >
            FallCon
          </h1>

          <p
            className="mt-2 text-xs tracking-[0.3em] uppercase"
            style={{
              color: 'rgba(201,168,76,0.5)',
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              letterSpacing: '0.3em',
            }}
          >
            Ticket Conductor
          </p>
        </motion.div>

        {/* Page content */}
        {children}

        {/* Footer */}
        <motion.p
          className="mt-8 text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          &copy; {new Date().getFullYear()} FallCon. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  )
}
