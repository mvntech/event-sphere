import { useEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useMotionValue, useReducedMotion, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(
    motionValue,
    reduceMotion ? { duration: 0 } : { damping: 60, stiffness: 100 }
  )
  useEffect(() => {
    const timer = setTimeout(
      () => {
        motionValue.set(direction === "down" ? startValue : value)
      },
      reduceMotion ? 0 : delay * 1000
    )

    return () => clearTimeout(timer)
  }, [motionValue, delay, value, direction, startValue, reduceMotion])

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
        }
      }),
    [springValue, decimalPlaces]
  )

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block text-current tabular-nums",
        className
      )}
      {...props}
    >
      {startValue}
    </span>
  )
}
