import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  threshold?: number
}

export function useInView<T extends HTMLElement = HTMLElement>(
  options?: UseInViewOptions,
) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: options?.threshold ?? 0.15 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, inView }
}
